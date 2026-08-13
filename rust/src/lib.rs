use wasm_bindgen::prelude::*;

const WIDTH: usize = 8;
const BLOCKS: usize = 4;
const Q: i32 = 256;
const FNV_OFFSET: u32 = 0x811c_9dc5;
const FNV_PRIME: u32 = 0x0100_0193;

const BOOT_LINES: [&str; 3] = [
    "[wasm] identity.q8 mapped into linear memory",
    "[wasm] 4 residual blocks / 8 channels / q8.8",
    "[wasm] output head bound to homepage.tokens",
];

const HOMEPAGE: &str = r#"Maksim Soltan
Programmer for fun.

(defmacro ❤ [&args]
  `(update-in me [:passionate :tech] conj ~@args))

❤ Go · Rust && C++ · Clojure[Script] · Scala.
❤ Functional programming.
❤ Linux · Vim · Git · Fish · Tmux · Xmonad.
❤ k8s · NixOS · Embedded systems · ML.

fn main(arg: &str) -> Result<()> {
  "github" => github.com/Gonzih,
  "blog"   => blog.gonzih.me,
  "email"  => gonzih@gmail.com,
  "cv"     => gonzih.notion.site/Max-Gonzih-CV-d6cb096878a24c9293f2ac8f0f6f87ee,
  _        => Ok(()),
}"#;

#[wasm_bindgen]
pub fn boot_line_count() -> u32 {
    BOOT_LINES.len() as u32
}

#[wasm_bindgen]
pub fn boot_line(index: u32) -> String {
    BOOT_LINES
        .get(index as usize)
        .copied()
        .unwrap_or("[wasm] decoder ready")
        .to_owned()
}

#[wasm_bindgen]
pub struct Inference {
    tokens: Vec<String>,
    weights: Vec<i16>,
    biases: Vec<i16>,
    state: [i16; WIDTH],
    token_index: usize,
    block: usize,
    ticks: u32,
    output_checksum: u32,
    model_checksum: u32,
}

#[wasm_bindgen]
impl Inference {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Inference {
        let mut seed = 0x6d61_6b73_u32;
        let mut weights = vec![0_i16; BLOCKS * WIDTH * WIDTH];
        let mut biases = vec![0_i16; BLOCKS * WIDTH];

        for block in 0..BLOCKS {
            for output in 0..WIDTH {
                for input in 0..WIDTH {
                    seed = xorshift32(seed);
                    let random = ((seed >> 24) as i16) - 128;
                    let diagonal = if input == output { 72 } else { 0 };
                    weights[weight_index(block, output, input)] =
                        (random + diagonal).clamp(-192, 192);
                }

                seed = xorshift32(seed);
                biases[block * WIDTH + output] = (((seed >> 25) as i16) - 64) / 2;
            }
        }

        let model_checksum = weights
            .iter()
            .chain(biases.iter())
            .fold(FNV_OFFSET, |hash, value| {
                value
                    .to_le_bytes()
                    .iter()
                    .fold(hash, |next, byte| fnv(next, *byte))
            });

        Inference {
            tokens: tokenize(HOMEPAGE),
            weights,
            biases,
            state: [0; WIDTH],
            token_index: 0,
            block: 0,
            ticks: 0,
            output_checksum: FNV_OFFSET,
            model_checksum,
        }
    }

    pub fn reset(&mut self) {
        self.state = [0; WIDTH];
        self.token_index = 0;
        self.block = 0;
        self.ticks = 0;
        self.output_checksum = FNV_OFFSET;
    }

    pub fn model_name(&self) -> String {
        "identity.q8".to_owned()
    }

    pub fn architecture(&self) -> String {
        format!("{}x{} residual / q8.8", BLOCKS, WIDTH)
    }

    pub fn runtime(&self) -> String {
        "rust / wasm32-unknown-unknown".to_owned()
    }

    pub fn token_count(&self) -> u32 {
        self.tokens.len() as u32
    }

    pub fn model_checksum(&self) -> u32 {
        self.model_checksum
    }

    pub fn done(&self) -> bool {
        self.token_index >= self.tokens.len()
    }

    pub fn step(&mut self) -> InferenceFrame {
        if self.done() {
            return InferenceFrame {
                block: self.block as u32,
                tick: self.ticks,
                token_index: self.tokens.len() as u32,
                token_count: self.tokens.len() as u32,
                input: self.state,
                output: self.state,
                contributions: vec![0; WIDTH * WIDTH],
                emitted: String::new(),
                energy_q8: 0,
                dominant: 0,
                output_checksum: self.output_checksum,
                done: true,
            };
        }

        let token = self.tokens[self.token_index].clone();
        if self.block == 0 {
            self.state = embed(&token, self.token_index as u32, self.output_checksum);
        }

        let input = self.state;
        let mut output = [0_i16; WIDTH];
        let mut contributions = vec![0_i16; WIDTH * WIDTH];

        for output_index in 0..WIDTH {
            let mut accumulator = self.biases[self.block * WIDTH + output_index] as i32;

            for input_index in 0..WIDTH {
                let weight = self.weights[weight_index(self.block, output_index, input_index)];
                let contribution =
                    ((input[input_index] as i32 * weight as i32) / Q).clamp(-511, 511);
                contributions[output_index * WIDTH + input_index] = contribution as i16;
                accumulator += contribution;
            }

            // A small residual path keeps the signal legible across all four blocks.
            accumulator += input[output_index] as i32 / 2;
            output[output_index] = squash_q8(accumulator);
        }

        let dominant = output
            .iter()
            .enumerate()
            .max_by_key(|(_, value)| value.unsigned_abs())
            .map(|(index, _)| index)
            .unwrap_or(0);
        let energy_q8 = output
            .iter()
            .map(|value| value.unsigned_abs() as u32)
            .sum::<u32>()
            / WIDTH as u32;

        let final_block = self.block + 1 == BLOCKS;
        let emitted = if final_block {
            for byte in token.as_bytes() {
                self.output_checksum = fnv(self.output_checksum, *byte);
            }
            self.token_index += 1;
            token
        } else {
            String::new()
        };

        let frame = InferenceFrame {
            block: self.block as u32,
            tick: self.ticks,
            token_index: if final_block {
                self.token_index as u32
            } else {
                self.token_index as u32 + 1
            },
            token_count: self.tokens.len() as u32,
            input,
            output,
            contributions,
            emitted,
            energy_q8,
            dominant: dominant as u32,
            output_checksum: self.output_checksum,
            done: final_block && self.done(),
        };

        self.state = output;
        self.block = if final_block { 0 } else { self.block + 1 };
        self.ticks = self.ticks.wrapping_add(1);
        frame
    }
}

#[wasm_bindgen]
pub struct InferenceFrame {
    block: u32,
    tick: u32,
    token_index: u32,
    token_count: u32,
    input: [i16; WIDTH],
    output: [i16; WIDTH],
    contributions: Vec<i16>,
    emitted: String,
    energy_q8: u32,
    dominant: u32,
    output_checksum: u32,
    done: bool,
}

#[wasm_bindgen]
impl InferenceFrame {
    pub fn block(&self) -> u32 {
        self.block
    }

    pub fn tick(&self) -> u32 {
        self.tick
    }

    pub fn token_index(&self) -> u32 {
        self.token_index
    }

    pub fn token_count(&self) -> u32 {
        self.token_count
    }

    pub fn input(&self) -> Vec<i16> {
        self.input.to_vec()
    }

    pub fn output(&self) -> Vec<i16> {
        self.output.to_vec()
    }

    pub fn contributions(&self) -> Vec<i16> {
        self.contributions.clone()
    }

    pub fn emitted(&self) -> String {
        self.emitted.clone()
    }

    pub fn energy_q8(&self) -> u32 {
        self.energy_q8
    }

    pub fn dominant(&self) -> u32 {
        self.dominant
    }

    pub fn output_checksum(&self) -> u32 {
        self.output_checksum
    }

    pub fn done(&self) -> bool {
        self.done
    }
}

fn weight_index(block: usize, output: usize, input: usize) -> usize {
    block * WIDTH * WIDTH + output * WIDTH + input
}

fn embed(token: &str, position: u32, context: u32) -> [i16; WIDTH] {
    let mut hash = token
        .as_bytes()
        .iter()
        .fold(FNV_OFFSET ^ position ^ context, |next, byte| {
            fnv(next, *byte)
        });
    let mut vector = [0_i16; WIDTH];

    for (index, value) in vector.iter_mut().enumerate() {
        hash = xorshift32(hash ^ (index as u32).wrapping_mul(0x9e37_79b9));
        *value = (((hash >> 24) as i16) - 128) * 2;
    }

    vector
}

fn squash_q8(value: i32) -> i16 {
    let clamped = value.clamp(-4096, 4096);
    ((clamped * Q) / (Q + clamped.abs())).clamp(-255, 255) as i16
}

fn tokenize(source: &str) -> Vec<String> {
    let mut tokens = Vec::new();
    let mut current = String::new();
    let mut current_class: Option<u8> = None;

    let flush = |tokens: &mut Vec<String>, current: &mut String| {
        if !current.is_empty() {
            tokens.push(core::mem::take(current));
        }
    };

    for character in source.chars() {
        if character == '\n' {
            flush(&mut tokens, &mut current);
            current_class = None;
            tokens.push("\n".to_owned());
            continue;
        }

        let class = if character.is_whitespace() {
            1
        } else if character.is_alphanumeric() || "_:/@.-+&[]?=<>".contains(character) {
            2
        } else {
            3
        };

        if class == 3 {
            flush(&mut tokens, &mut current);
            current_class = None;
            tokens.push(character.to_string());
        } else {
            if current_class.is_some_and(|previous| previous != class) {
                flush(&mut tokens, &mut current);
            }
            current_class = Some(class);
            current.push(character);
        }
    }

    flush(&mut tokens, &mut current);
    tokens
}

#[inline(always)]
fn fnv(hash: u32, byte: u8) -> u32 {
    (hash ^ byte as u32).wrapping_mul(FNV_PRIME)
}

#[inline(always)]
fn xorshift32(mut value: u32) -> u32 {
    value ^= value << 13;
    value ^= value >> 17;
    value ^= value << 5;
    value
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decoder_emits_exact_homepage() {
        let mut model = Inference::new();
        let mut decoded = String::new();

        while !model.done() {
            decoded.push_str(&model.step().emitted);
        }

        assert_eq!(decoded, HOMEPAGE);
        assert!(model.token_count() > 100);
    }

    #[test]
    fn propagation_is_deterministic() {
        let mut first = Inference::new();
        let mut second = Inference::new();

        for _ in 0..64 {
            let left = first.step();
            let right = second.step();
            assert_eq!(left.output, right.output);
            assert_eq!(left.contributions, right.contributions);
        }
    }
}

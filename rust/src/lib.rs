use wasm_bindgen::prelude::*;

const BOOT_LINES: [&str; 4] = [
    "[wasm] rust guest instantiated",
    "[wasm] deterministic kernels mapped",
    "[worker] telemetry channel attached",
    "[host] frame clock sampling",
];

#[wasm_bindgen]
pub fn boot_line_count() -> u32 {
    BOOT_LINES.len() as u32
}

#[wasm_bindgen]
pub fn boot_line(index: u32) -> String {
    BOOT_LINES
        .get(index as usize)
        .copied()
        .unwrap_or("[wasm] ready")
        .to_owned()
}

#[wasm_bindgen]
pub fn guest_abi() -> String {
    "rust/wasm32-unknown-unknown".to_owned()
}

#[wasm_bindgen]
pub struct Probe {
    links: Vec<u32>,
    cursor: u32,
    state: u32,
}

#[wasm_bindgen]
impl Probe {
    #[wasm_bindgen(constructor)]
    pub fn new(requested_bytes: u32) -> Probe {
        let requested_words =
            (requested_bytes as usize / core::mem::size_of::<u32>()).clamp(16_384, 1_048_576);
        let words = requested_words.next_power_of_two();

        let mut order: Vec<u32> = (0..words as u32).collect();
        let mut seed = 0x6d61_6b73_u32;

        // Build one deterministic permutation cycle. Following it defeats
        // sequential prefetch while keeping every load inside linear memory.
        for index in (1..words).rev() {
            seed = xorshift32(seed);
            let swap_with = seed as usize % (index + 1);
            order.swap(index, swap_with);
        }

        let mut links = vec![0_u32; words];
        for index in 0..words {
            let current = order[index] as usize;
            links[current] = order[(index + 1) & (words - 1)];
        }

        Probe {
            cursor: order[0],
            links,
            state: seed,
        }
    }

    pub fn scalar(&mut self, rounds: u32) -> u32 {
        let mut state = self.state;

        for step in 0..rounds {
            state ^= step.wrapping_mul(0x9e37_79b9);
            state = state.rotate_left(7).wrapping_mul(0x85eb_ca6b);
            state ^= state >> 13;
            state = state.wrapping_add(0xc2b2_ae35);
        }

        self.state = state;
        state
    }

    pub fn branch(&mut self, rounds: u32) -> u32 {
        let mut state = self.state;
        let mut taken = 0_u32;

        for step in 0..rounds {
            state = xorshift32(state ^ step);
            if state & 0x8000_0000 == 0 {
                state = state.rotate_left(11).wrapping_add(0x27d4_eb2d);
            } else {
                state = state.rotate_right(9).wrapping_mul(0x1656_67b1);
                taken = taken.wrapping_add(1);
            }
        }

        self.state = state ^ taken;
        self.state
    }

    pub fn linear_scan(&mut self, passes: u32) -> u32 {
        let mut checksum = self.state;

        for pass in 0..passes {
            for (index, value) in self.links.iter().enumerate() {
                checksum =
                    checksum.rotate_left(5) ^ value.wrapping_add(index as u32).wrapping_add(pass);
            }
        }

        self.state = checksum;
        checksum
    }

    pub fn pointer_chase(&mut self, steps: u32) -> u32 {
        let mut cursor = self.cursor as usize;
        let mask = self.links.len() - 1;
        let mut checksum = self.state;

        for step in 0..steps {
            cursor = self.links[cursor & mask] as usize;
            checksum = checksum.rotate_left(3) ^ cursor as u32 ^ step;
        }

        self.cursor = cursor as u32;
        self.state = checksum;
        checksum
    }

    pub fn buffer_bytes(&self) -> u32 {
        (self.links.len() * core::mem::size_of::<u32>()) as u32
    }
}

#[inline(always)]
fn xorshift32(mut value: u32) -> u32 {
    value ^= value << 13;
    value ^= value >> 17;
    value ^= value << 5;
    value
}

#[cfg(all(feature = "simd", target_arch = "wasm32"))]
#[target_feature(enable = "simd128")]
unsafe fn simd_mix_inner(rounds: u32) -> u32 {
    use core::arch::wasm32::*;

    let mut lanes = i32x4(
        0x6d61_6b73_u32 as i32,
        0x9e37_79b9_u32 as i32,
        0x85eb_ca6b_u32 as i32,
        0xc2b2_ae35_u32 as i32,
    );
    let increment = i32x4(0x1357_9bdf, 0x2468_ace1, 0x1020_4081, 0x55aa_33cc);
    let multiplier = i32x4(0x27d4_eb2d, 0x1656_67b1, 0x1b87_3593, 0x5bd1_e995);

    for step in 0..rounds {
        lanes = i32x4_add(lanes, increment);
        lanes = v128_xor(lanes, i32x4_shl(lanes, 5));
        lanes = i32x4_mul(lanes, multiplier);
        lanes = v128_xor(lanes, i32x4_splat(step as i32));
    }

    (i32x4_extract_lane::<0>(lanes) as u32)
        ^ (i32x4_extract_lane::<1>(lanes) as u32)
        ^ (i32x4_extract_lane::<2>(lanes) as u32)
        ^ (i32x4_extract_lane::<3>(lanes) as u32)
}

#[cfg(feature = "simd")]
#[wasm_bindgen]
pub fn simd_mix(rounds: u32) -> u32 {
    #[cfg(target_arch = "wasm32")]
    unsafe {
        return simd_mix_inner(rounds);
    }

    #[cfg(not(target_arch = "wasm32"))]
    {
        let mut value = 0x6d61_6b73_u32;
        for step in 0..rounds {
            value = xorshift32(value ^ step);
        }
        value
    }
}

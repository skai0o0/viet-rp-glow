use aho_corasick::AhoCorasick;
use once_cell::sync::Lazy;
use tiktoken_rs::cl100k_base;
use wasm_bindgen::prelude::*;

// ── NSFW keyword lists ──────────────────────────────────────────

/// Longer / unambiguous keywords safe for substring matching.
const SUBSTRING_KEYWORDS: &[&str] = &[
    // Labels
    "nsfw", "erotic", "hentai", "porn", "naked", "xxx", "r-18", "r18",
    // Acts / themes
    "bdsm", "bondage", "fetish", "kink",
    "netorare", "cuckold", "mind break", "mind control",
    "non-con", "dubcon", "noncon", "blackmail", "coercion",
    "gangbang", "incest", "threesome", "orgy", "foursome",
    "master-slave", "pet play", "slave play",
    "breeding", "impregnation", "mating press",
    "ahegao", "tentacle", "futanari",
    "creampie", "blowjob", "handjob", "footjob", "rimjob",
    "nipple", "genital", "penis", "vagina", "clitoris", "phallus",
    "undress", "groping", "fondle", "molest",
    "voyeur", "peeping",
    "aphrodisiac", "love potion",
    "dominatrix", "sadomaso",
    // Body / nudity
    "topless", "bottomless", "nude photo", "strip tease",
    "lingerie", "see-through",
    // Violence / gore
    "gore", "guro", "snuff", "disembowel", "eviscerate",
    // Problematic
    "loli", "shota", "underage", "pedophil",
    // Substance
    "drugged", "intoxicated", "roofie",
    // Mythological
    "succubus", "incubus",
    // Vietnamese keywords
    "khiêu dâm", "dâm dục", "quan hệ tình dục",
    "cưỡng hiếp", "hiếp dâm", "cưỡng bức",
    "loạn luân", "đồi trụy",
    "nô lệ tình dục",
    "khỏa thân", "lõa thể", "trần truồng",
    "thủ dâm", "kích dục",
    "giao cấu", "giao hợp",
    "cưỡng dâm", "dâm ô",
    "biến thái", "thác loạn",
    "nứng", "sục cặc", "bú cặc", "liếm lồn",
    "địt", "chịch",
];

/// Short / ambiguous keywords that need word-boundary matching.
/// We use Aho-Corasick for speed, then verify word boundaries in a second pass.
const BOUNDARY_WORDS: &[&str] = &[
    "sex", "rape", "oral", "anal", "cum", "cock", "dick",
    "pussy", "tits", "boob", "slut", "whore", "milf",
    "dildo", "vibrator", "orgasm",
];

/// Compiled Aho-Corasick automaton for substring keywords (case-insensitive).
/// Compiled once on first use, then reused for all subsequent calls.
static SUBSTRING_AUTOMATON: Lazy<AhoCorasick> = Lazy::new(|| {
    AhoCorasick::builder()
        .ascii_case_insensitive(true)
        .build(SUBSTRING_KEYWORDS)
        .expect("Failed to build substring automaton")
});

/// Compiled Aho-Corasick for boundary keywords (case-insensitive).
static BOUNDARY_AUTOMATON: Lazy<AhoCorasick> = Lazy::new(|| {
    AhoCorasick::builder()
        .ascii_case_insensitive(true)
        .build(BOUNDARY_WORDS)
        .expect("Failed to build boundary automaton")
});

/// Check if a byte is a word-boundary character (not alphanumeric or underscore).
fn is_word_boundary(b: u8) -> bool {
    !b.is_ascii_alphanumeric() && b != b'_'
}

// ── Tokenizer (tiktoken-rs) ─────────────────────────────────────

/// Count tokens in text using cl100k_base encoding (GPT-4 / Claude compatible).
#[wasm_bindgen]
pub fn count_tokens(text: &str) -> usize {
    let bpe = cl100k_base().expect("Failed to load cl100k_base encoding");
    bpe.encode_with_special_tokens(text).len()
}

/// Truncate text to fit within `max_tokens` using cl100k_base encoding.
/// Returns the decoded string (may end mid-word).
#[wasm_bindgen]
pub fn truncate_to_tokens(text: &str, max_tokens: usize) -> String {
    let bpe = cl100k_base().expect("Failed to load cl100k_base encoding");
    let tokens = bpe.encode_with_special_tokens(text);
    if tokens.len() <= max_tokens {
        return text.to_string();
    }
    let truncated = &tokens[..max_tokens];
    bpe.decode(truncated.to_vec()).unwrap_or_default()
}

// ── NSFW Filter (Aho-Corasick) ──────────────────────────────────

/// Check if text contains any NSFW keyword.
/// Uses Aho-Corasick for O(n) single-pass matching.
#[wasm_bindgen]
pub fn is_nsfw(text: &str) -> bool {
    let lower = text.to_lowercase();

    // Layer 1: substring keywords (unambiguous, no boundary check needed)
    if SUBSTRING_AUTOMATON.is_match(&lower) {
        return true;
    }

    // Layer 2: boundary keywords — match then verify word boundaries
    for mat in BOUNDARY_AUTOMATON.find_iter(&lower) {
        let start = mat.start();
        let end = mat.end();
        let before_ok = start == 0 || is_word_boundary(lower.as_bytes()[start - 1]);
        let after_ok = end >= lower.len() || is_word_boundary(lower.as_bytes()[end]);
        if before_ok && after_ok {
            return true;
        }
    }

    false
}

/// Get all matched NSFW keywords in text.
/// Returns a JS array of strings.
#[wasm_bindgen]
pub fn get_nsfw_tags(text: &str) -> js_sys::Array {
    let lower = text.to_lowercase();
    let result = js_sys::Array::new();
    let mut seen = std::collections::HashSet::new();

    // Substring matches
    for mat in SUBSTRING_AUTOMATON.find_iter(&lower) {
        let keyword = &SUBSTRING_KEYWORDS[mat.pattern()];
        if seen.insert(keyword.to_string()) {
            result.push(&JsValue::from_str(keyword));
        }
    }

    // Boundary matches with word-boundary verification
    for mat in BOUNDARY_AUTOMATON.find_iter(&lower) {
        let start = mat.start();
        let end = mat.end();
        let before_ok = start == 0 || is_word_boundary(lower.as_bytes()[start - 1]);
        let after_ok = end >= lower.len() || is_word_boundary(lower.as_bytes()[end]);
        if before_ok && after_ok {
            let keyword = &BOUNDARY_WORDS[mat.pattern()];
            if seen.insert(keyword.to_string()) {
                result.push(&JsValue::from_str(keyword));
            }
        }
    }

    result
}

#include "editor.h"
#include "graphics.h"
#include "interpreter.h"
#include "visualizer.h"
#include "presets.h"
#include "audio.h"
#include "samples.h"
#include "storage.h"
#include <string.h>
#include <stdio.h>
#include <stdlib.h>
#include <math.h>

static EditorState s_editor;
static int s_preset_index = 0;

static const char* S_D_MENU_CATEGORIES[] = {
    "KEYWORDS", "SAMPLES", "OPERATORS", "NUMBERS", "VARIABLES"
};
#define D_MENU_NUM_CATEGORIES 5

static const char* S_KEYWORD_ITEMS[] = {
    "every",
    "play.",
    "if",
    "random.",
    "[ ]",
    "+ Add Line Below",
    "+ Add Line Above"
};
#define KEYWORD_ITEMS_COUNT 7

static const char* S_OPERATOR_ITEMS[] = {
    "[ ]",
    "+",
    "-",
    "*",
    "/",
    "%",
    "=",
    "==",
    "!=",
    "<",
    ">",
    "<=",
    ">=",
    ",",
    ":"
};
#define OPERATOR_ITEMS_COUNT 15

static const char* S_NUMBER_ITEMS[] = {
    "0.125",
    "0.25",
    "0.5",
    "1",
    "2",
    "4",
    "8",
    "16",
    "32",
    "40",
    "60",
    "75",
    "80",
    "120"
};
#define NUMBER_ITEMS_COUNT 14

static const char* S_VAR_BASE_ITEMS[] = {
    "+ Generate Random Var",
    "bpm",
    "tempo",
    "pitch",
    "gain",
    "scale"
};
#define VAR_BASE_COUNT 6

static int get_variable_menu_items(char out_names[64][32]) {
    int count = 0;
    for (int i = 0; i < VAR_BASE_COUNT && count < 64; i++) {
        strncpy(out_names[count++], S_VAR_BASE_ITEMS[i], 31);
    }
    for (int i = 0; i < s_editor.program.var_count && count < 64; i++) {
        const char* name = s_editor.program.vars[i].name;
        if (strcmp(name, "bpm") == 0 || strcmp(name, "tempo") == 0 ||
            strcmp(name, "pitch") == 0 || strcmp(name, "gain") == 0 ||
            strcmp(name, "scale") == 0) continue;
        bool dup = false;
        for (int k = 0; k < count; k++) {
            if (strcmp(out_names[k], name) == 0) { dup = true; break; }
        }
        if (!dup) {
            strncpy(out_names[count++], name, 31);
        }
    }
    for (int i = 0; i < s_editor.custom_var_count && count < 64; i++) {
        const char* name = s_editor.custom_vars[i];
        bool dup = false;
        for (int k = 0; k < count; k++) {
            if (strcmp(out_names[k], name) == 0) { dup = true; break; }
        }
        if (!dup) {
            strncpy(out_names[count++], name, 31);
        }
    }
    return count;
}

void editor_init(const char* initial_code) {
    memset(&s_editor, 0, sizeof(EditorState));
    storage_init();

    if (initial_code) {
        strncpy(s_editor.code, initial_code, CODE_BUFFER_SIZE - 1);
    } else {
        // "always open last saved file upon boot. if none, then open blank."
        char last_code[CODE_BUFFER_SIZE];
        if (storage_load_last(last_code, sizeof(last_code)) && last_code[0] != '\0') {
            snprintf(s_editor.code, sizeof(s_editor.code), "%s", last_code);
            snprintf(s_editor.notification, sizeof(s_editor.notification), "Loaded last_saved.txt");
            s_editor.notification_timer = 2.5f;
        } else {
            // Open blank!
            s_editor.code[0] = '\0';
            snprintf(s_editor.notification, sizeof(s_editor.notification), "Blank Program");
            s_editor.notification_timer = 2.0f;
        }
    }
    parser_parse(s_editor.code, &s_editor.program);
    interpreter_set_program(&s_editor.program);
    samples_load_for_program(&s_editor.program);
    s_editor.selected_token_idx = 0;
    s_editor.cursor_after_token = false;
    s_editor.hide_visualizer = false;

    // "don't start playing untl start is pressed."
    interpreter_set_playing(false);
}

void editor_update(float dt) {
    s_editor.caret_frame++;
    if (s_editor.notification_timer > 0.0f) {
        s_editor.notification_timer -= dt;
        if (s_editor.notification_timer < 0.0f) s_editor.notification_timer = 0.0f;
    }
}

void editor_load_preset(int preset_idx) {
    if (preset_idx < 0 || preset_idx >= (int)PRESET_COUNT) preset_idx = 0;
    s_preset_index = preset_idx;
    strncpy(s_editor.code, S_DEMO_PRESETS[preset_idx], CODE_BUFFER_SIZE - 1);
    s_editor.selected_token_idx = 0;
    s_editor.scroll_x = 0;
    s_editor.scroll_y = 0;
    parser_parse(s_editor.code, &s_editor.program);
    interpreter_set_program(&s_editor.program);
    samples_load_for_program(&s_editor.program);
    snprintf(s_editor.notification, sizeof(s_editor.notification), "Preset %d: %s", preset_idx, S_PRESET_NAMES[preset_idx]);
    s_editor.notification_timer = 2.5f;
}

void editor_new_program(void) {
    s_editor.code[0] = '\0';
    s_editor.selected_token_idx = 0;
    s_editor.scroll_x = 0;
    s_editor.scroll_y = 0;
    parser_parse(s_editor.code, &s_editor.program);
    interpreter_set_program(&s_editor.program);
    interpreter_set_playing(false);
    snprintf(s_editor.notification, sizeof(s_editor.notification), "New Blank Program");
    s_editor.notification_timer = 2.5f;
}

bool editor_save_current(void) {
    bool ok1 = storage_save_last(s_editor.code);
    char slot_name[MAX_FILENAME_LEN];
    storage_get_next_slot_name(slot_name, sizeof(slot_name));
    bool ok2 = storage_save_file(slot_name, s_editor.code);
    if (ok1 || ok2) {
        snprintf(s_editor.notification, sizeof(s_editor.notification), "Saved: %s & last_saved.txt", slot_name);
        s_editor.notification_timer = 3.0f;
        return true;
    }
    snprintf(s_editor.notification, sizeof(s_editor.notification), "Save Failed!");
    s_editor.notification_timer = 2.5f;
    return false;
}

bool editor_open_file(const char* filename) {
    char loaded[CODE_BUFFER_SIZE];
    if (storage_load_file(filename, loaded, sizeof(loaded))) {
        strncpy(s_editor.code, loaded, sizeof(s_editor.code) - 1);
        s_editor.code[sizeof(s_editor.code) - 1] = '\0';
        s_editor.selected_token_idx = 0;
        s_editor.scroll_x = 0;
        s_editor.scroll_y = 0;
        parser_parse(s_editor.code, &s_editor.program);
        interpreter_set_program(&s_editor.program);
        samples_load_for_program(&s_editor.program);
        snprintf(s_editor.notification, sizeof(s_editor.notification), "Opened: %s", filename);
        s_editor.notification_timer = 2.5f;
        return true;
    }
    snprintf(s_editor.notification, sizeof(s_editor.notification), "Failed to open %s", filename);
    s_editor.notification_timer = 2.5f;
    return false;
}

const char* editor_get_code(void) {
    return s_editor.code;
}

Program* editor_get_program(void) {
    return &s_editor.program;
}

static void apply_code_change(void) {
    parser_parse(s_editor.code, &s_editor.program);
    interpreter_set_program(&s_editor.program);
    samples_load_for_program(&s_editor.program);
    if (s_editor.selected_token_idx >= s_editor.program.token_count) {
        s_editor.selected_token_idx = s_editor.program.token_count > 0 ? s_editor.program.token_count - 1 : 0;
    }
}

static void update_editor_code(const char* new_code) {
    if (!new_code) return;
    strncpy(s_editor.code, new_code, sizeof(s_editor.code) - 1);
    s_editor.code[sizeof(s_editor.code) - 1] = '\0';
    apply_code_change();
}

// Modify number token value: decimals (Up/Down) or integers (Left/Right)
static void modify_number(Token* tok, float delta, bool is_decimal) {
    float new_val;
    if (is_decimal) {
        new_val = tok->num_value + delta;
    } else {
        new_val = roundf(tok->num_value) + delta;
    }
    if (new_val < 0.0f) new_val = 0.0f;

    char new_text[32];
    if (!is_decimal) {
        snprintf(new_text, sizeof(new_text), "%d", (int)roundf(new_val));
    } else {
        new_val = roundf(new_val * 100.0f) / 100.0f;
        if (fabsf(new_val - roundf(new_val)) < 0.001f) {
            snprintf(new_text, sizeof(new_text), "%.1f", new_val);
        } else {
            snprintf(new_text, sizeof(new_text), "%.2f", new_val);
        }
    }

    char new_code[CODE_BUFFER_SIZE * 2];
    snprintf(new_code, sizeof(new_code), "%.*s%s%s", tok->start, s_editor.code, new_text, s_editor.code + tok->end);
    update_editor_code(new_code);
}

// Cycle sample token
static void modify_sample(Token* tok, int dir) {
    int cat_count = samples_get_catalog_count();
    if (cat_count == 0) return;

    int cur_idx = -1;
    for (int i = 0; i < cat_count; i++) {
        if (strcasecmp(samples_get_catalog_name(i), tok->text) == 0) {
            cur_idx = i;
            break;
        }
    }
    if (cur_idx < 0) cur_idx = 0;
    int next_idx = (cur_idx + dir + cat_count) % cat_count;
    const char* next_name = samples_get_catalog_name(next_idx);
    if (!next_name) return;
    samples_ensure_loaded(next_name);

    char new_code[CODE_BUFFER_SIZE * 2];
    snprintf(new_code, sizeof(new_code), "%.*s%s%s", tok->start, s_editor.code, next_name, s_editor.code + tok->end);
    update_editor_code(new_code);
}

// Delete token or empty line
static void delete_token(Token* tok) {
    if (!tok) return;
    int start = tok->start;
    int end = tok->end;

    if (tok->type == TOK_EMPTY_LINE) {
        // If empty line, delete newline to join lines
        if (s_editor.code[end] == '\n') end++;
        else if (start > 0 && s_editor.code[start - 1] == '\n') start--;
        char new_code[CODE_BUFFER_SIZE * 2];
        snprintf(new_code, sizeof(new_code), "%.*s%s", start, s_editor.code, s_editor.code + end);
        update_editor_code(new_code);
        return;
    }

    // Clean up following comma or newline if lonely
    if (s_editor.code[end] == ',' && s_editor.code[end + 1] == ' ') end += 2;
    else if (s_editor.code[end] == ',') end += 1;

    char new_code[CODE_BUFFER_SIZE * 2];
    snprintf(new_code, sizeof(new_code), "%.*s%s", start, s_editor.code, s_editor.code + end);
    update_editor_code(new_code);
    if (s_editor.selected_token_idx > 0) {
        s_editor.selected_token_idx--;
        s_editor.cursor_after_token = true;
    } else {
        s_editor.cursor_after_token = false;
    }
    s_editor.caret_frame = 0;
}

// Insert snippet at current position, replacing empty line if on one
static void insert_snippet(const char* snippet) {
    if (!snippet) return;

    if (s_editor.code[0] == '\0') {
        update_editor_code(snippet);
        s_editor.selected_token_idx = 0;
        s_editor.cursor_after_token = true;
        s_editor.caret_frame = 0;
        return;
    }

    Token* cur = (s_editor.selected_token_idx < s_editor.program.token_count) 
        ? &s_editor.program.tokens[s_editor.selected_token_idx] : NULL;
    
    char new_code[CODE_BUFFER_SIZE * 2];
    int inserted_pos = 0;

    if (cur && cur->type == TOK_EMPTY_LINE) {
        // Replace empty line
        bool ends_with_nl = snippet[strlen(snippet) - 1] == '\n';
        snprintf(new_code, sizeof(new_code), "%.*s%s%s%s", 
            cur->start, s_editor.code, 
            snippet, 
            ends_with_nl ? "" : "\n",
            s_editor.code + cur->end);
        inserted_pos = cur->start;
    } else {
        int insert_pos = cur ? cur->end : (int)strlen(s_editor.code);
        if (strchr(snippet, '\n')) {
            const char* newline = strchr(s_editor.code + insert_pos, '\n');
            int line_end = newline ? (int)(newline - s_editor.code + 1) : (int)strlen(s_editor.code);
            snprintf(new_code, sizeof(new_code), "%.*s\n%s%s", line_end, s_editor.code, snippet, s_editor.code + line_end);
            inserted_pos = line_end + 1;
        } else {
            bool need_space = true;
            if (insert_pos == 0 || s_editor.code[insert_pos - 1] == ' ' || 
                s_editor.code[insert_pos - 1] == '\n' || s_editor.code[insert_pos - 1] == '.' ||
                s_editor.code[insert_pos - 1] == '[' || snippet[0] == ']' || snippet[0] == ',') {
                need_space = false;
            }
            snprintf(new_code, sizeof(new_code), "%.*s%s%s%s", 
                insert_pos, s_editor.code, 
                need_space ? " " : "",
                snippet, 
                s_editor.code + insert_pos);
            inserted_pos = insert_pos + (need_space ? 1 : 0);
        }
    }

    update_editor_code(new_code);

    // Position cursor on newly inserted token and place caret to the right!
    for (int i = 0; i < s_editor.program.token_count; i++) {
        if (s_editor.program.tokens[i].start >= inserted_pos) {
            s_editor.selected_token_idx = i;
            break;
        }
    }
    s_editor.cursor_after_token = true;
    s_editor.caret_frame = 0;
}

static void add_empty_line_above(void) {
    Token* cur = (s_editor.selected_token_idx < s_editor.program.token_count) 
        ? &s_editor.program.tokens[s_editor.selected_token_idx] : NULL;
    int line_start = 0;
    if (cur) {
        for (int p = cur->start - 1; p >= 0; p--) {
            if (s_editor.code[p] == '\n') {
                line_start = p + 1;
                break;
            }
        }
    }
    char new_code[CODE_BUFFER_SIZE * 2];
    snprintf(new_code, sizeof(new_code), "%.*s\n%s", line_start, s_editor.code, s_editor.code + line_start);
    update_editor_code(new_code);
}

static void add_empty_line_below(void) {
    Token* cur = (s_editor.selected_token_idx < s_editor.program.token_count) 
        ? &s_editor.program.tokens[s_editor.selected_token_idx] : NULL;
    int line_end = (int)strlen(s_editor.code);
    bool should_indent = false;
    if (cur) {
        for (int p = cur->start; p >= 0 && s_editor.code[p] != '\n'; p--) {
            if (strncmp(s_editor.code + p, "every", 5) == 0) {
                should_indent = true;
                break;
            }
        }
        const char* nl = strchr(s_editor.code + cur->start, '\n');
        if (nl) line_end = (int)(nl - s_editor.code + 1);
    }
    char new_code[CODE_BUFFER_SIZE * 2];
    snprintf(new_code, sizeof(new_code), "%.*s%s\n%s", 
        line_end, s_editor.code, 
        should_indent ? "  " : "", 
        s_editor.code + line_end);
    update_editor_code(new_code);
    s_editor.selected_token_idx++;
}

static void insert_token_component(const char* comp) {
    if (!comp) return;

    // 1. Line insertion helpers
    if (strcmp(comp, "+ Add Line Below") == 0) {
        add_empty_line_below();
        return;
    }
    if (strcmp(comp, "+ Add Line Above") == 0) {
        add_empty_line_above();
        return;
    }

    // 2. Generate Random Variable Name
    if (strcmp(comp, "+ Generate Random Var") == 0) {
        const char* rname = parser_generate_random_var_name(&s_editor.program);
        bool found = false;
        for (int i = 0; i < s_editor.custom_var_count; i++) {
            if (strcmp(s_editor.custom_vars[i], rname) == 0) { found = true; break; }
        }
        if (!found && s_editor.custom_var_count < 16) {
            strncpy(s_editor.custom_vars[s_editor.custom_var_count++], rname, 31);
        }

        Token* cur = (s_editor.selected_token_idx < s_editor.program.token_count)
            ? &s_editor.program.tokens[s_editor.selected_token_idx] : NULL;

        char buf[64];
        if (!cur || cur->type == TOK_EMPTY_LINE || s_editor.code[0] == '\0') {
            snprintf(buf, sizeof(buf), "%s = 1", rname);
            insert_snippet(buf);
        } else {
            insert_snippet(rname);
        }
        snprintf(s_editor.notification, sizeof(s_editor.notification), "Generated: %s", rname);
        s_editor.notification_timer = 2.0f;
        return;
    }

    // 3. Inserting [ ]
    if (strcmp(comp, "[ ]") == 0) {
        Token* cur = (s_editor.selected_token_idx < s_editor.program.token_count)
            ? &s_editor.program.tokens[s_editor.selected_token_idx] : NULL;

        char new_code[CODE_BUFFER_SIZE * 2];
        if (!cur || cur->type == TOK_EMPTY_LINE || s_editor.code[0] == '\0') {
            insert_snippet("[ ]");
        } else if (cur->type == TOK_SAMPLE || cur->type == TOK_SYNTH ||
                   strcmp(cur->text, "random") == 0 ||
                   (cur->end > 0 && s_editor.code[cur->end - 1] == '.')) {
            // Attach directly without space after play.sample or random.
            snprintf(new_code, sizeof(new_code), "%.*s[ ]%s", cur->end, s_editor.code, s_editor.code + cur->end);
            update_editor_code(new_code);
        } else {
            snprintf(new_code, sizeof(new_code), "%.*s [ ]%s", cur->end, s_editor.code, s_editor.code + cur->end);
            update_editor_code(new_code);
        }

        // Position cursor on the newly inserted '[' with caret to the right of '[' (inside brackets)
        for (int i = 0; i < s_editor.program.token_count; i++) {
            if (s_editor.program.tokens[i].text[0] == '[') {
                if (!cur || s_editor.program.tokens[i].start >= cur->start) {
                    s_editor.selected_token_idx = i;
                    s_editor.cursor_after_token = true;
                    s_editor.caret_frame = 0;
                    break;
                }
            }
        }
        snprintf(s_editor.notification, sizeof(s_editor.notification), "Added [ ]: Now add elements inside");
        s_editor.notification_timer = 2.0f;
        return;
    }

    Token* cur = (s_editor.selected_token_idx < s_editor.program.token_count)
        ? &s_editor.program.tokens[s_editor.selected_token_idx] : NULL;

    // 4. If cursor is on '[': insert element inside the brackets
    if (cur && cur->text[0] == '[') {
        const char* close_bracket = strchr(s_editor.code + cur->start, ']');
        if (close_bracket) {
            int close_pos = (int)(close_bracket - s_editor.code);
            bool is_empty = true;
            for (int p = cur->end; p < close_pos; p++) {
                if (s_editor.code[p] != ' ' && s_editor.code[p] != '\t') {
                    is_empty = false;
                    break;
                }
            }
            char new_code[CODE_BUFFER_SIZE * 2];
            if (is_empty) {
                // Replace empty space with element: "[comp]"
                snprintf(new_code, sizeof(new_code), "%.*s%s%s", cur->end, s_editor.code, comp, s_editor.code + close_pos);
            } else {
                // Insert at start of non-empty array: "[comp, ...]"
                snprintf(new_code, sizeof(new_code), "%.*s%s, %s", cur->end, s_editor.code, comp, s_editor.code + cur->end);
            }
            update_editor_code(new_code);
            // Position cursor on the newly inserted item with caret to the right
            for (int i = 0; i < s_editor.program.token_count; i++) {
                if (s_editor.program.tokens[i].start >= cur->end) {
                    s_editor.selected_token_idx = i;
                    s_editor.cursor_after_token = true;
                    s_editor.caret_frame = 0;
                    break;
                }
            }
            return;
        }
    }

    // 5. If cursor is on an element inside [ ... ]: append element with comma
    if (cur && cur->type != TOK_EMPTY_LINE && cur->text[0] != ']') {
        int open_pos = -1;
        for (int p = cur->start - 1; p >= 0 && s_editor.code[p] != '\n'; p--) {
            if (s_editor.code[p] == ']') break;
            if (s_editor.code[p] == '[') {
                open_pos = p;
                break;
            }
        }
        const char* close_bracket = strchr(s_editor.code + cur->end, ']');
        const char* next_nl = strchr(s_editor.code + cur->end, '\n');
        if (open_pos != -1 && close_bracket && (!next_nl || close_bracket < next_nl)) {
            // We are inside an array! Append ", comp" right after cur->end
            char new_code[CODE_BUFFER_SIZE * 2];
            snprintf(new_code, sizeof(new_code), "%.*s, %s%s", cur->end, s_editor.code, comp, s_editor.code + cur->end);
            update_editor_code(new_code);
            for (int i = 0; i < s_editor.program.token_count; i++) {
                if (s_editor.program.tokens[i].start > cur->end) {
                    s_editor.selected_token_idx = i;
                    s_editor.cursor_after_token = true;
                    s_editor.caret_frame = 0;
                    break;
                }
            }
            return;
        }
    }

    // 6. Sample name attachment: if previous token was "play" or ends with '.'
    if (cur && (strcmp(cur->text, "play") == 0 || cur->text[strlen(cur->text)-1] == '.' ||
                (cur->end > 0 && s_editor.code[cur->end - 1] == '.'))) {
        char new_code[CODE_BUFFER_SIZE * 2];
        snprintf(new_code, sizeof(new_code), "%.*s%s%s", cur->end, s_editor.code, comp, s_editor.code + cur->end);
        update_editor_code(new_code);
        s_editor.selected_token_idx++;
        s_editor.cursor_after_token = true;
        s_editor.caret_frame = 0;
        samples_ensure_loaded(comp);
        return;
    }

    // 7. Special variables when on empty line:
    if ((!cur || cur->type == TOK_EMPTY_LINE || s_editor.code[0] == '\0') && strcmp(comp, "bpm") == 0) {
        insert_snippet("bpm = 120");
        return;
    }
    if ((!cur || cur->type == TOK_EMPTY_LINE || s_editor.code[0] == '\0') && strcmp(comp, "scale") == 0) {
        insert_snippet("scale = [60, 62, 64, 67]");
        return;
    }

    // 8. General token / snippet insertion
    insert_snippet(comp);
}

// Continuous repeat timer helper for D-Pad buttons
static int s_repeat_up = 0;
static int s_repeat_down = 0;
static int s_repeat_left = 0;
static int s_repeat_right = 0;

static bool check_repeat(bool is_pressed, int* counter) {
    if (!is_pressed) {
        *counter = 0;
        return false;
    }
    (*counter)++;
    if (*counter == 1) {
        return true; // First frame trigger
    }
    const int INITIAL_HOLD_DELAY = 15; // ~250ms at 60 FPS
    if (*counter >= INITIAL_HOLD_DELAY) {
        int held_frames = *counter - INITIAL_HOLD_DELAY;
        // After 40 frames (~0.65s), accelerate repeat rate from 4 frames to 2 frames
        int repeat_rate = (held_frames > 40) ? 2 : 4;
        if (held_frames % repeat_rate == 0) {
            return true;
        }
    }
    return false;
}

static void editor_move_line_up(void) {
    if (s_editor.program.token_count == 0) return;
    Token* cur_tok = (s_editor.selected_token_idx < s_editor.program.token_count)
        ? &s_editor.program.tokens[s_editor.selected_token_idx] : &s_editor.program.tokens[0];
    int cur_line = cur_tok->line;
    if (cur_line <= 0) return;

    int target_line = cur_line - 1;
    while (target_line >= 0) {
        int best_idx = -1;
        int min_dist = 9999;
        for (int i = 0; i < s_editor.program.token_count; i++) {
            if (s_editor.program.tokens[i].line == target_line) {
                int dist = abs(s_editor.program.tokens[i].col - cur_tok->col);
                if (dist < min_dist) {
                    min_dist = dist;
                    best_idx = i;
                }
            }
        }
        if (best_idx != -1) {
            s_editor.selected_token_idx = best_idx;
            return;
        }
        target_line--;
    }
}

static void editor_move_line_down(void) {
    if (s_editor.program.token_count == 0) return;
    Token* cur_tok = (s_editor.selected_token_idx < s_editor.program.token_count)
        ? &s_editor.program.tokens[s_editor.selected_token_idx] : &s_editor.program.tokens[0];
    int cur_line = cur_tok->line;

    int max_line = 0;
    for (int i = 0; i < s_editor.program.token_count; i++) {
        if (s_editor.program.tokens[i].line > max_line) max_line = s_editor.program.tokens[i].line;
    }
    if (cur_line >= max_line) return;

    int target_line = cur_line + 1;
    while (target_line <= max_line) {
        int best_idx = -1;
        int min_dist = 9999;
        for (int i = 0; i < s_editor.program.token_count; i++) {
            if (s_editor.program.tokens[i].line == target_line) {
                int dist = abs(s_editor.program.tokens[i].col - cur_tok->col);
                if (dist < min_dist) {
                    min_dist = dist;
                    best_idx = i;
                }
            }
        }
        if (best_idx != -1) {
            s_editor.selected_token_idx = best_idx;
            return;
        }
        target_line++;
    }
}

static void toggle_mute_every_block(void) {
    if (s_editor.program.token_count == 0) return;
    Token* cur_tok = (s_editor.selected_token_idx < s_editor.program.token_count)
        ? &s_editor.program.tokens[s_editor.selected_token_idx] : NULL;
    if (!cur_tok) return;

    int cur_line = cur_tok->line;
    int line_num = 0;
    int block_start = 0;
    for (int i = 0; s_editor.code[i] != '\0' && line_num < cur_line; i++) {
        if (s_editor.code[i] == '\n') {
            line_num++;
            block_start = i + 1;
        }
    }

    const char* p = s_editor.code + block_start;
    while (*p == ' ' || *p == '\t') p++;

    bool is_block_comment = false;
    bool is_line_comment = false;
    bool is_active_every = false;

    if (strncmp(p, "{-", 2) == 0) {
        const char* sub = p + 2;
        while (*sub == ' ' || *sub == '\t') sub++;
        if (strncmp(sub, "every", 5) == 0) {
            is_block_comment = true;
        }
    } else if (strncmp(p, "--", 2) == 0) {
        const char* sub = p + 2;
        while (*sub == ' ' || *sub == '\t') sub++;
        if (strncmp(sub, "every", 5) == 0) {
            is_line_comment = true;
        }
    } else if (strncmp(p, "every", 5) == 0) {
        is_active_every = true;
    }

    if (!is_block_comment && !is_line_comment && !is_active_every) {
        snprintf(s_editor.notification, sizeof(s_editor.notification), "Highlight 'every' to mute/unmute");
        s_editor.notification_timer = 1.5f;
        return;
    }

    int block_end = (int)strlen(s_editor.code);
    for (int i = block_start; s_editor.code[i] != '\0'; i++) {
        if (s_editor.code[i] == '\n') {
            int next_l = i + 1;
            const char* np = s_editor.code + next_l;
            while (*np == ' ' || *np == '\t') np++;
            bool is_next_every = false;
            if (strncmp(np, "every", 5) == 0) is_next_every = true;
            else if (strncmp(np, "{-", 2) == 0) {
                const char* s2 = np + 2;
                while (*s2 == ' ' || *s2 == '\t') s2++;
                if (strncmp(s2, "every", 5) == 0) is_next_every = true;
            } else if (strncmp(np, "--", 2) == 0) {
                const char* s2 = np + 2;
                while (*s2 == ' ' || *s2 == '\t') s2++;
                if (strncmp(s2, "every", 5) == 0) is_next_every = true;
            }

            if (is_next_every) {
                block_end = next_l;
                break;
            }
        }
    }

    char new_code[CODE_BUFFER_SIZE];
    new_code[0] = '\0';

    if (is_block_comment) {
        int n_len = 0;
        memcpy(new_code, s_editor.code, block_start);
        n_len = block_start;

        int i = block_start;
        while (i < block_end && (s_editor.code[i] == ' ' || s_editor.code[i] == '\t')) {
            new_code[n_len++] = s_editor.code[i++];
        }
        if (i < block_end && s_editor.code[i] == '{' && s_editor.code[i+1] == '-') {
            i += 2;
            if (i < block_end && s_editor.code[i] == ' ') i++;
        }

        while (i < block_end) {
            if (s_editor.code[i] == '-' && s_editor.code[i+1] == '}') {
                i += 2;
                if (n_len > 0 && new_code[n_len - 1] == ' ') n_len--;
                continue;
            }
            new_code[n_len++] = s_editor.code[i++];
        }

        strcpy(&new_code[n_len], &s_editor.code[block_end]);

        strncpy(s_editor.code, new_code, sizeof(s_editor.code) - 1);
        s_editor.code[sizeof(s_editor.code) - 1] = '\0';
        apply_code_change();
        snprintf(s_editor.notification, sizeof(s_editor.notification), "Unmuted every loop [X+L+R]");
        s_editor.notification_timer = 1.5f;

    } else if (is_line_comment) {
        int n_len = block_start;
        memcpy(new_code, s_editor.code, block_start);

        int i = block_start;
        bool at_line_start = true;
        while (i < block_end) {
            if (at_line_start) {
                while (i < block_end && (s_editor.code[i] == ' ' || s_editor.code[i] == '\t')) {
                    new_code[n_len++] = s_editor.code[i++];
                }
                if (i < block_end && s_editor.code[i] == '-' && s_editor.code[i+1] == '-') {
                    i += 2;
                    if (i < block_end && s_editor.code[i] == ' ') i++;
                }
                at_line_start = false;
            }
            if (i < block_end) {
                if (s_editor.code[i] == '\n') at_line_start = true;
                new_code[n_len++] = s_editor.code[i++];
            }
        }
        strcpy(&new_code[n_len], &s_editor.code[block_end]);

        strncpy(s_editor.code, new_code, sizeof(s_editor.code) - 1);
        s_editor.code[sizeof(s_editor.code) - 1] = '\0';
        apply_code_change();
        snprintf(s_editor.notification, sizeof(s_editor.notification), "Unmuted every loop [X+L+R]");
        s_editor.notification_timer = 1.5f;

    } else if (is_active_every) {
        int n_len = block_start;
        memcpy(new_code, s_editor.code, block_start);

        memcpy(&new_code[n_len], "{- ", 3);
        n_len += 3;

        int content_end = block_end;
        while (content_end > block_start && (s_editor.code[content_end - 1] == '\n' || s_editor.code[content_end - 1] == '\r')) {
            content_end--;
        }
        int block_len = content_end - block_start;
        if (block_len > 0) {
            memcpy(&new_code[n_len], &s_editor.code[block_start], block_len);
            n_len += block_len;
        }

        memcpy(&new_code[n_len], " -}\n\n", 5);
        n_len += 5;

        strcpy(&new_code[n_len], &s_editor.code[block_end]);

        strncpy(s_editor.code, new_code, sizeof(s_editor.code) - 1);
        s_editor.code[sizeof(s_editor.code) - 1] = '\0';
        apply_code_change();
        snprintf(s_editor.notification, sizeof(s_editor.notification), "Muted every loop [X+L+R]");
        s_editor.notification_timer = 1.5f;
    }
}

void editor_handle_input(ControllerInput input, ControllerInput prev_input) {
    bool cross_down = input.cross && !prev_input.cross;
    bool circle_down = input.circle && !prev_input.circle;
    bool square_down = input.square && !prev_input.square;
    bool triangle_down = input.triangle && !prev_input.triangle;
    bool l_down = input.l_trigger && !prev_input.l_trigger;
    bool r_down = input.r_trigger && !prev_input.r_trigger;
    bool start_down = input.start && !prev_input.start;
    bool select_down = input.select && !prev_input.select;

    // Continuous repeat for D-Pad (works for navigation, value scrubbing, and menus)
    bool up_act = check_repeat(input.up, &s_repeat_up);
    bool down_act = check_repeat(input.down, &s_repeat_down);
    bool left_act = check_repeat(input.left, &s_repeat_left);
    bool right_act = check_repeat(input.right, &s_repeat_right);

    s_editor.is_holding_cross = input.cross;

    // Every Mute Combo: X + L + R (toggles comments over loop)
    bool is_mute_combo = (input.cross && input.l_trigger && input.r_trigger) &&
                         (cross_down || l_down || r_down);
    if (is_mute_combo) {
        toggle_mute_every_block();
        return;
    }

    // Start: Toggle play
    if (start_down) {
        interpreter_toggle_play();
        return;
    }

    // Select: Toggle System Menu (Presets, Open, Save, New)
    if (select_down) {
        if (s_editor.modal == MODAL_SYS_MENU) {
            s_editor.modal = MODAL_NONE;
        } else {
            s_editor.modal = MODAL_SYS_MENU;
            s_editor.is_d_menu_open = false;
            s_editor.sys_menu_tab = 0; // Default to PRESETS tab
            s_editor.sys_menu_idx = s_preset_index;
            s_editor.file_list_count = storage_list_files(s_editor.file_list);
        }
        return;
    }

    // Quick preset cycling when holding SELECT and tapping Left / Right
    if (input.select && !select_down) {
        if (left_act || l_down) {
            editor_load_preset((s_preset_index - 1 + PRESET_COUNT) % PRESET_COUNT);
            return;
        }
        if (right_act || r_down) {
            editor_load_preset((s_preset_index + 1) % PRESET_COUNT);
            return;
        }
    }

    // 1. System Menu Mode (Presets, Open, Save, New)
    if (s_editor.modal == MODAL_SYS_MENU) {
        if (circle_down || square_down) {
            s_editor.modal = MODAL_NONE; // Close menu
            return;
        }

        // Left / Right: Switch between tabs
        // Tab 0: PRESETS, Tab 1: FILES, Tab 2: NEW PROGRAM, Tab 3: SETTINGS
        if (left_act) {
            s_editor.sys_menu_tab = (s_editor.sys_menu_tab - 1 + 4) % 4;
            s_editor.sys_menu_idx = 0;
            if (s_editor.sys_menu_tab == 1) {
                s_editor.file_list_count = storage_list_files(s_editor.file_list);
            }
        } else if (right_act) {
            s_editor.sys_menu_tab = (s_editor.sys_menu_tab + 1) % 4;
            s_editor.sys_menu_idx = 0;
            if (s_editor.sys_menu_tab == 1) {
                s_editor.file_list_count = storage_list_files(s_editor.file_list);
            }
        }

        int max_items = 1;
        if (s_editor.sys_menu_tab == 0) {
            max_items = PRESET_COUNT;
        } else if (s_editor.sys_menu_tab == 1) {
            // Files tab: [0] Save last, [1] Save As, [2..N] Open file
            max_items = 2 + s_editor.file_list_count;
        } else if (s_editor.sys_menu_tab == 2) {
            max_items = 1; // "Create Blank Program"
        } else if (s_editor.sys_menu_tab == 3) {
            max_items = 1; // "Visualizer: [SHOWN]/[HIDDEN]"
        }

        if (up_act) {
            s_editor.sys_menu_idx = (s_editor.sys_menu_idx > 0) ? s_editor.sys_menu_idx - 1 : max_items - 1;
        } else if (down_act) {
            s_editor.sys_menu_idx = (s_editor.sys_menu_idx + 1) % max_items;
        }

        // Cross or Triangle: Select option
        if (cross_down || triangle_down) {
            if (s_editor.sys_menu_tab == 0) { // Presets
                editor_load_preset(s_editor.sys_menu_idx % PRESET_COUNT);
                s_editor.modal = MODAL_NONE;
            } else if (s_editor.sys_menu_tab == 1) { // Files
                if (s_editor.sys_menu_idx == 0) {
                    // Quick Save to last_saved.txt
                    editor_save_current();
                    s_editor.modal = MODAL_NONE;
                } else if (s_editor.sys_menu_idx == 1) {
                    // Save As next slot
                    editor_save_current();
                    s_editor.modal = MODAL_NONE;
                } else {
                    // Open selected file
                    int f_idx = s_editor.sys_menu_idx - 2;
                    if (f_idx >= 0 && f_idx < s_editor.file_list_count) {
                        editor_open_file(s_editor.file_list[f_idx]);
                        s_editor.modal = MODAL_NONE;
                    }
                }
            } else if (s_editor.sys_menu_tab == 2) { // New Program
                editor_new_program();
                s_editor.modal = MODAL_NONE;
            } else if (s_editor.sys_menu_tab == 3) { // Settings: Hide / Show Viz
                s_editor.hide_visualizer = !s_editor.hide_visualizer;
                snprintf(s_editor.notification, sizeof(s_editor.notification), "Visualizer: %s", 
                    s_editor.hide_visualizer ? "HIDDEN" : "SHOWN");
                s_editor.notification_timer = 2.0f;
            }
        }
        return;
    }

    // 2. D Dropdown Menu Mode (when open)
    if (s_editor.modal == MODAL_D_MENU || s_editor.is_d_menu_open) {
        if (circle_down || square_down) {
            s_editor.modal = MODAL_NONE;
            s_editor.is_d_menu_open = false; // Cancel
            return;
        }

        if (left_act) {
            s_editor.d_menu_category = (s_editor.d_menu_category - 1 + D_MENU_NUM_CATEGORIES) % D_MENU_NUM_CATEGORIES;
            s_editor.d_menu_item_idx = 0;
        } else if (right_act) {
            s_editor.d_menu_category = (s_editor.d_menu_category + 1) % D_MENU_NUM_CATEGORIES;
            s_editor.d_menu_item_idx = 0;
        }

        char var_menu_items[64][32];
        int var_menu_count = 0;
        if (s_editor.d_menu_category == 4) {
            var_menu_count = get_variable_menu_items(var_menu_items);
        }

        int max_items = 1;
        if (s_editor.d_menu_category == 0) max_items = KEYWORD_ITEMS_COUNT;
        else if (s_editor.d_menu_category == 1) max_items = samples_get_catalog_count();
        else if (s_editor.d_menu_category == 2) max_items = OPERATOR_ITEMS_COUNT;
        else if (s_editor.d_menu_category == 3) max_items = NUMBER_ITEMS_COUNT;
        else if (s_editor.d_menu_category == 4) max_items = var_menu_count;

        if (max_items < 1) max_items = 1;

        if (up_act) {
            s_editor.d_menu_item_idx = (s_editor.d_menu_item_idx > 0) ? s_editor.d_menu_item_idx - 1 : max_items - 1;
        } else if (down_act) {
            s_editor.d_menu_item_idx = (s_editor.d_menu_item_idx + 1) % max_items;
        }

        // Triangle or Cross: Confirm choice
        if (triangle_down || cross_down) {
            s_editor.modal = MODAL_NONE;
            s_editor.is_d_menu_open = false;
            switch (s_editor.d_menu_category) {
                case 0: // Keywords
                    if (s_editor.d_menu_item_idx >= 0 && s_editor.d_menu_item_idx < KEYWORD_ITEMS_COUNT) {
                        insert_token_component(S_KEYWORD_ITEMS[s_editor.d_menu_item_idx]);
                    }
                    break;
                case 1: { // Samples
                    int cat_count = samples_get_catalog_count();
                    if (cat_count > 0) {
                        int idx = s_editor.d_menu_item_idx % cat_count;
                        const char* sname = samples_get_catalog_name(idx);
                        if (sname) insert_token_component(sname);
                    }
                    break;
                }
                case 2: // Operators & [ ]
                    if (s_editor.d_menu_item_idx >= 0 && s_editor.d_menu_item_idx < OPERATOR_ITEMS_COUNT) {
                        const char* ops[] = {
                            "[ ]", "+", "-", "*", "/", "%", "=", "==", "!=", "<", ">", "<=", ">=", ",", ":"
                        };
                        insert_token_component(ops[s_editor.d_menu_item_idx]);
                    }
                    break;
                case 3: // Numbers
                    if (s_editor.d_menu_item_idx >= 0 && s_editor.d_menu_item_idx < NUMBER_ITEMS_COUNT) {
                        insert_token_component(S_NUMBER_ITEMS[s_editor.d_menu_item_idx]);
                    }
                    break;
                case 4: // Variables
                    if (s_editor.d_menu_item_idx >= 0 && s_editor.d_menu_item_idx < var_menu_count) {
                        insert_token_component(var_menu_items[s_editor.d_menu_item_idx]);
                    }
                    break;
            }
        }
        return;
    }

    // 3. Normal Controller Navigation Mode
    Token* cur_tok = (s_editor.selected_token_idx < s_editor.program.token_count)
        ? &s_editor.program.tokens[s_editor.selected_token_idx] : NULL;

    // Triangle: Re-evaluate code
    if (triangle_down) {
        apply_code_change();
        snprintf(s_editor.notification, sizeof(s_editor.notification), "Code Re-evaluated");
        s_editor.notification_timer = 1.5f;
        return;
    }

    // Circle: Open D Menu
    if (circle_down) {
        s_editor.modal = MODAL_D_MENU;
        s_editor.is_d_menu_open = true;
        s_editor.d_menu_category = 0;
        s_editor.d_menu_item_idx = 0;
        return;
    }

    // Square: Delete token or empty line
    if (square_down && cur_tok) {
        delete_token(cur_tok);
        return;
    }

    // Cross Held: Scrub Values with D-Pad Left/Right (Continuous repeat enabled!)
    if (s_editor.is_holding_cross && cur_tok) {
        if (cur_tok->type == TOK_NUMBER) {
            if (right_act) {
                modify_number(cur_tok, +1.0f, false);
                return;
            } else if (left_act) {
                modify_number(cur_tok, -1.0f, false);
                return;
            }
        } else if (cur_tok->type == TOK_SAMPLE) {
            if (right_act) {
                modify_sample(cur_tok, 1);
                return;
            } else if (left_act) {
                modify_sample(cur_tok, -1);
                return;
            }
        } else {
            // Scroll line horizontally when holding Cross on other tokens
            if (right_act) {
                s_editor.scroll_x += 2;
                return;
            } else if (left_act) {
                s_editor.scroll_x = (s_editor.scroll_x >= 2) ? s_editor.scroll_x - 2 : 0;
                return;
            }
        }
        // Note: up_act and down_act intentionally fall through so Up/Down ALWAYS navigates lines!
    }

    // D-Pad Navigation (Continuous repeat enabled when held!)
    // Up/Down: ALWAYS go to new line above or below
    // Left/Right: navigate token by token with right-of-element caret placement
    if (right_act) {
        if (!s_editor.cursor_after_token) {
            // Move to the right of the current element (caret position)
            s_editor.cursor_after_token = true;
            s_editor.caret_frame = 0;
        } else {
            // Already to the right of current element. Move to next token on this line if available
            if (cur_tok && s_editor.selected_token_idx < s_editor.program.token_count - 1 &&
                s_editor.program.tokens[s_editor.selected_token_idx + 1].line == cur_tok->line) {
                s_editor.selected_token_idx++;
                s_editor.cursor_after_token = false;
                s_editor.caret_frame = 0;
            } else {
                s_editor.scroll_x += 2;
            }
        }
    } else if (left_act) {
        if (s_editor.cursor_after_token) {
            // Move from right of element back onto the element itself
            s_editor.cursor_after_token = false;
            s_editor.caret_frame = 0;
        } else {
            // Already on element. Move to the right of previous token on this line if available
            if (cur_tok && s_editor.selected_token_idx > 0 &&
                s_editor.program.tokens[s_editor.selected_token_idx - 1].line == cur_tok->line) {
                s_editor.selected_token_idx--;
                s_editor.cursor_after_token = true;
                s_editor.caret_frame = 0;
            } else if (s_editor.scroll_x > 0) {
                s_editor.scroll_x = (s_editor.scroll_x >= 2) ? s_editor.scroll_x - 2 : 0;
            }
        }
    } else if (up_act) {
        editor_move_line_up();
        s_editor.caret_frame = 0;
    } else if (down_act) {
        editor_move_line_down();
        s_editor.caret_frame = 0;
    }

    // L / R Shoulder Triggers (or Q / R keys): Skip lines up or down
    if (l_down) {
        editor_move_line_up();
        return;
    } else if (r_down) {
        editor_move_line_down();
        return;
    }
}

void editor_render(void) {
    graphics_clear(COLOR_BG);

    // 1. Top Header
    graphics_draw_rect(0, 0, SCREEN_WIDTH, 14, 0xFF11111B);
    graphics_draw_text(6, 3, "SHIFT PSP", COLOR_ACCENT);

    // Determine current token coordinates for auto-scrolling
    Token* cur_tok = (s_editor.selected_token_idx < s_editor.program.token_count) 
        ? &s_editor.program.tokens[s_editor.selected_token_idx] : NULL;
    int cur_line = cur_tok ? cur_tok->line : 0;
    int cur_col = cur_tok ? cur_tok->col : 0;

    int display_col = cur_col + (s_editor.cursor_after_token && cur_tok ? (int)strlen(cur_tok->text) : 0);
    char pos_str[48];
    snprintf(pos_str, sizeof(pos_str), "Ln %d Col %d%s", cur_line + 1, display_col + 1, s_editor.cursor_after_token ? " [|]" : "");
    graphics_draw_text(90, 3, pos_str, 0x88CDD6F4);

    char bpm_str[32];
    snprintf(bpm_str, sizeof(bpm_str), "%.0f BPM", interpreter_get_bpm());
    graphics_draw_text(180, 3, bpm_str, COLOR_ACCENT);

    char status[64];
    snprintf(status, sizeof(status), "%s | PRESET %d", 
        interpreter_is_playing() ? "[PLAYING]" : "[PAUSED]", s_preset_index);
    graphics_draw_text(245, 3, status, interpreter_is_playing() ? COLOR_SAMPLE : COLOR_NUMBER);

    // 2. Code Editor Area
    int max_draw_x = s_editor.hide_visualizer ? (SCREEN_WIDTH - 16) : 306;
    if (!s_editor.hide_visualizer) {
        graphics_draw_line(316, 14, 316, SCREEN_HEIGHT - 14, 0x4445475A);
    }

    // Count total code lines
    int total_code_lines = 1;
    for (int i = 0; s_editor.code[i] != '\0'; i++) {
        if (s_editor.code[i] == '\n') total_code_lines++;
    }

    // Auto-scroll vertical (scroll_y): keep active line in view
    const int VISIBLE_LINES = 20;
    if (cur_line < s_editor.scroll_y + 2) {
        s_editor.scroll_y = (cur_line > 2) ? cur_line - 2 : 0;
    } else if (cur_line >= s_editor.scroll_y + VISIBLE_LINES - 2) {
        s_editor.scroll_y = cur_line - VISIBLE_LINES + 3;
    }
    int max_scroll_y = total_code_lines - VISIBLE_LINES + 2;
    if (max_scroll_y < 0) max_scroll_y = 0;
    if (s_editor.scroll_y > max_scroll_y) s_editor.scroll_y = max_scroll_y;
    if (s_editor.scroll_y < 0) s_editor.scroll_y = 0;

    // Auto-scroll horizontal (scroll_x): keep active token in view if line extends off screen
    int tok_len = cur_tok ? (int)strlen(cur_tok->text) : 1;
    if (tok_len < 1) tok_len = 1;
    int cur_col_end = cur_col + tok_len + (s_editor.cursor_after_token ? 1 : 0);
    const int VISIBLE_COLS = s_editor.hide_visualizer ? 56 : 36;
    if (cur_col < s_editor.scroll_x + 1) {
        s_editor.scroll_x = (cur_col > 1) ? cur_col - 1 : 0;
    } else if (cur_col_end > s_editor.scroll_x + VISIBLE_COLS) {
        s_editor.scroll_x = cur_col_end - VISIBLE_COLS + 1;
    }
    if (s_editor.scroll_x < 0) s_editor.scroll_x = 0;

    // Draw bounding highlight box or type caret (carrot)
    if (cur_tok && cur_tok->type != TOK_EMPTY_LINE) {
        int sel_line = cur_tok->line - s_editor.scroll_y;
        int sel_col = cur_tok->col - s_editor.scroll_x;
        int tok_len = (int)strlen(cur_tok->text);
        if (tok_len < 1) tok_len = 1;
        if (sel_line >= 0 && sel_line < VISIBLE_LINES + 2) {
            int sy = 18 + sel_line * 11;
            int sx = 12 + sel_col * 8;
            int sw = tok_len * 8;
            if (sx < 12) { sw -= (12 - sx); sx = 12; }
            if (sx + sw > max_draw_x) sw = max_draw_x - sx;
            if (sw > 0 && sy >= 15 && sy <= SCREEN_HEIGHT - 26) {
                if (s_editor.cursor_after_token) {
                    // Caret positioned to the right of the element!
                    graphics_draw_rect_outline(sx - 1, sy - 1, sw + 2, 10, 0x44CDD6F4);

                    int cx = 12 + (cur_tok->col + tok_len - s_editor.scroll_x) * 8;
                    if (cx >= 12 && cx <= max_draw_x) {
                        bool blink = ((s_editor.caret_frame / 18) % 2) == 0;
                        uint32_t caret_col = blink ? 0xFFFFFFFF : COLOR_ACCENT;
                        graphics_draw_rect(cx - 1, sy - 1, 2, 11, caret_col);
                        graphics_draw_pixel(cx - 2, sy - 1, caret_col);
                        graphics_draw_pixel(cx + 1, sy - 1, caret_col);
                        graphics_draw_pixel(cx - 2, sy + 9, caret_col);
                        graphics_draw_pixel(cx + 1, sy + 9, caret_col);
                    }
                } else {
                    // Element itself is selected
                    uint32_t glow = s_editor.is_holding_cross ? COLOR_SCRUBBING : COLOR_SELECTED;
                    graphics_draw_rect(sx - 1, sy - 1, sw + 2, 10, glow & 0x44FFFFFF);
                    graphics_draw_rect_outline(sx - 1, sy - 1, sw + 2, 10, glow);
                }
            }
        }
    }

    // Render code characters with scroll offsets and strict clipping to editor pane
    int line_num = 0;
    int col_num = 0;
    int token_ptr = 0;
    bool line_extended = false;
    bool line_left_extended = false;
    int overflow_right_x = s_editor.hide_visualizer ? (SCREEN_WIDTH - 12) : 308;

    for (int i = 0; s_editor.code[i] != '\0'; i++) {
        if (s_editor.code[i] == '\n') {
            int draw_y = 18 + (line_num - s_editor.scroll_y) * 11;
            if (draw_y >= 15 && draw_y <= SCREEN_HEIGHT - 26) {
                if (line_extended) {
                    graphics_draw_char(overflow_right_x, draw_y, '>', COLOR_ACCENT);
                }
                if (line_left_extended) {
                    graphics_draw_char(2, draw_y, '<', COLOR_SCRUBBING);
                }
            }
            line_num++;
            col_num = 0;
            line_extended = false;
            line_left_extended = false;
            continue;
        }

        int draw_line = line_num - s_editor.scroll_y;
        int draw_col = col_num - s_editor.scroll_x;
        int current_col_pos = col_num++;

        if (current_col_pos < s_editor.scroll_x) {
            line_left_extended = true;
        }
        if (current_col_pos > s_editor.scroll_x + VISIBLE_COLS) {
            line_extended = true;
        }

        // Determine token color for this char
        uint32_t char_color = COLOR_TEXT;
        while (token_ptr < s_editor.program.token_count && i >= s_editor.program.tokens[token_ptr].end) {
            token_ptr++;
        }

        if (token_ptr < s_editor.program.token_count && i >= s_editor.program.tokens[token_ptr].start) {
            Token* tok = &s_editor.program.tokens[token_ptr];
            if (tok->type == TOK_KEYWORD) char_color = COLOR_ACCENT;
            else if (tok->type == TOK_NUMBER) char_color = COLOR_NUMBER;
            else if (tok->type == TOK_SAMPLE) char_color = COLOR_SAMPLE;
            else if (tok->type == TOK_SYNTH) char_color = 0xFFF5C2E7;
            else if (tok->type == TOK_OPERATOR) char_color = COLOR_OPERATOR;
            else if (tok->type == TOK_COMMENT) char_color = COLOR_COMMENT;
        }

        // Only draw if line is vertically on screen
        if (draw_line < 0 || draw_line >= VISIBLE_LINES + 2) continue;
        int y = 18 + draw_line * 11;
        if (y < 15 || y > SCREEN_HEIGHT - 26) continue;

        // Only draw if horizontally within editor area
        int x = 12 + draw_col * 8;
        if (x < 10 || x > max_draw_x) continue;

        graphics_draw_char(x, y, s_editor.code[i], char_color);
    }

    // Flush last line overflow indicators if script doesn't end in newline
    int last_draw_y = 18 + (line_num - s_editor.scroll_y) * 11;
    if (last_draw_y >= 15 && last_draw_y <= SCREEN_HEIGHT - 26) {
        if (line_extended) {
            graphics_draw_char(overflow_right_x, last_draw_y, '>', COLOR_ACCENT);
        }
        if (line_left_extended) {
            graphics_draw_char(2, last_draw_y, '<', COLOR_SCRUBBING);
        }
    }

    // Vertical scrollbar track and thumb
    int sb_x = s_editor.hide_visualizer ? (SCREEN_WIDTH - 6) : 314;
    int arrow_x = s_editor.hide_visualizer ? (SCREEN_WIDTH - 12) : 308;
    if (total_code_lines > VISIBLE_LINES) {
        int track_h = SCREEN_HEIGHT - 32;
        int thumb_h = (track_h * VISIBLE_LINES) / total_code_lines;
        if (thumb_h < 12) thumb_h = 12;
        int thumb_y = 16 + (s_editor.scroll_y * (track_h - thumb_h)) / (total_code_lines - VISIBLE_LINES);
        graphics_draw_rect(sb_x, 16, 2, track_h, 0x33FFFFFF);
        graphics_draw_rect(sb_x - 1, thumb_y, 4, thumb_h, COLOR_ACCENT);

        if (s_editor.scroll_y > 0) {
            graphics_draw_char(arrow_x, 16, '^', COLOR_ACCENT);
        }
        if (s_editor.scroll_y + VISIBLE_LINES < total_code_lines) {
            graphics_draw_char(arrow_x, SCREEN_HEIGHT - 26, 'v', COLOR_ACCENT);
        }
    }

    // Draw empty line indicator if selected token is TOK_EMPTY_LINE
    if (cur_tok && cur_tok->type == TOK_EMPTY_LINE) {
        int draw_line = cur_tok->line - s_editor.scroll_y;
        if (draw_line >= 0 && draw_line < VISIBLE_LINES + 2) {
            int empty_y = 18 + draw_line * 11;
            if (empty_y >= 15 && empty_y <= SCREEN_HEIGHT - 26) {
                uint32_t glow = s_editor.is_holding_cross ? COLOR_SCRUBBING : COLOR_SELECTED;
                graphics_draw_rect(12, empty_y - 1, 110, 10, glow & 0x44FFFFFF);
                graphics_draw_rect_outline(12, empty_y - 1, 110, 10, glow);
                graphics_draw_text(16, empty_y, "+ [EMPTY LINE]", COLOR_ACCENT);
            }
        }
    }

    // Draw blank program guidance if code is empty
    if (s_editor.code[0] == '\0') {
        graphics_draw_text(20, 36, "-- BLANK PROGRAM --", COLOR_COMMENT);
        graphics_draw_text(20, 56, "Press (O)  : Token Menu", 0xCCDCE0E8);
        graphics_draw_text(20, 72, "Press SEL  : Presets & Files", COLOR_NUMBER);
        graphics_draw_text(20, 88, "Press START: Play / Pause", COLOR_SAMPLE);
    }

    // 3. Right Visualizer Area (conditional based on settings)
    if (!s_editor.hide_visualizer) {
        visualizer_render();
    }

    // 4. Bottom HUD Controller Legend (solid opaque 0xFF11111B)
    graphics_draw_rect(0, SCREEN_HEIGHT - 14, SCREEN_WIDTH, 14, 0xFF11111B);
    if (cur_tok && cur_tok->type == TOK_EMPTY_LINE) {
        graphics_draw_text(6, SCREEN_HEIGHT - 11, "EMPTY LINE: (O) Add Token  [] Del Line  UP/DN Move", COLOR_ACCENT);
    } else if (s_editor.is_holding_cross) {
        if (cur_tok && cur_tok->type == TOK_NUMBER) {
            graphics_draw_text(6, SCREEN_HEIGHT - 11, "HOLDING [X] -> L/R: Scrub Number  UP/DN: Line  [X+L+R]: Mute", COLOR_NUMBER);
        } else if (cur_tok && cur_tok->type == TOK_SAMPLE) {
            graphics_draw_text(6, SCREEN_HEIGHT - 11, "HOLDING [X] -> L/R: Cycle Sample  UP/DN: Line  [X+L+R]: Mute", COLOR_SAMPLE);
        } else {
            graphics_draw_text(6, SCREEN_HEIGHT - 11, "HOLDING [X] -> L/R: Scroll Line   UP/DN: Line  [X+L+R]: Mute", COLOR_NUMBER);
        }
    } else {
        graphics_draw_text(6, SCREEN_HEIGHT - 11, "D-PAD:Move(UP/DN Line) [X]+L/R:Scrub [X+L+R]:Mute (O):Add []:Del", 0x99CDD6F4);
    }

    // Toast Notification Banner (centered over editor pane)
    if (s_editor.notification_timer > 0.0f && s_editor.notification[0] != '\0') {
        int nw = (int)strlen(s_editor.notification) * 8 + 20;
        int pane_w = s_editor.hide_visualizer ? SCREEN_WIDTH : 316;
        int nx = (pane_w - nw) / 2;
        if (nx < 8) nx = 8;
        int ny = SCREEN_HEIGHT - 32;
        graphics_draw_rect(nx, ny, nw, 15, 0xFF181825);
        graphics_draw_rect_outline(nx, ny, nw, 15, COLOR_ACCENT);
        graphics_draw_text(nx + 10, ny + 3, s_editor.notification, COLOR_ACCENT);
    }

    // 5. D Token Menu Modal Overlay (when open)
    if (s_editor.is_d_menu_open) {
        int mw = 230;
        int mh = 145;
        int mx = (SCREEN_WIDTH - mw) / 2;
        int my = (SCREEN_HEIGHT - mh) / 2;

        graphics_draw_rect(mx, my, mw, mh, 0xFF181825);
        graphics_draw_rect_outline(mx, my, mw, mh, COLOR_ACCENT);

        // Header
        graphics_draw_text(mx + 8, my + 6, "TOKEN MENU (SIMPLE COMPONENTS)", COLOR_ACCENT);
        graphics_draw_line(mx, my + 18, mx + mw, my + 18, 0x44FFFFFF);

        // Category Tab
        char tab_text[64];
        snprintf(tab_text, sizeof(tab_text), "< Tab %d/5: %s >", s_editor.d_menu_category + 1, S_D_MENU_CATEGORIES[s_editor.d_menu_category]);
        graphics_draw_text(mx + 12, my + 24, tab_text, COLOR_NUMBER);

        // Scroll offset for item list (display 6 items)
        int start_item = (s_editor.d_menu_item_idx >= 5) ? s_editor.d_menu_item_idx - 4 : 0;
        int item_y = my + 40;

        if (s_editor.d_menu_category == 0) { // KEYWORDS
            for (int k = 0; k < 6; k++) {
                int item_i = start_item + k;
                if (item_i >= KEYWORD_ITEMS_COUNT) break;
                uint32_t col = (item_i == s_editor.d_menu_item_idx) ? COLOR_ACCENT : 0x88CDD6F4;
                if (item_i == s_editor.d_menu_item_idx) {
                    graphics_draw_rect(mx + 8, item_y - 1, mw - 16, 11, 0x33CBA6F7);
                }
                graphics_draw_text(mx + 14, item_y, S_KEYWORD_ITEMS[item_i], col);
                item_y += 13;
            }
        } else if (s_editor.d_menu_category == 1) { // SAMPLES
            int cat_count = samples_get_catalog_count();
            for (int k = 0; k < 6; k++) {
                int item_i = start_item + k;
                if (item_i >= cat_count) break;
                const char* sname = samples_get_catalog_name(item_i);
                uint32_t col = (item_i == s_editor.d_menu_item_idx) ? COLOR_SAMPLE : 0x88CDD6F4;
                if (item_i == s_editor.d_menu_item_idx) {
                    graphics_draw_rect(mx + 8, item_y - 1, mw - 16, 11, 0x33A6E3A1);
                }
                if (sname) {
                    char sbuf[32];
                    snprintf(sbuf, sizeof(sbuf), "play.%s", sname);
                    graphics_draw_text(mx + 14, item_y, sbuf, col);
                }
                item_y += 13;
            }
        } else if (s_editor.d_menu_category == 2) { // OPERATORS
            for (int k = 0; k < 6; k++) {
                int item_i = start_item + k;
                if (item_i >= OPERATOR_ITEMS_COUNT) break;
                uint32_t col = (item_i == s_editor.d_menu_item_idx) ? COLOR_OPERATOR : 0x88CDD6F4;
                if (item_i == s_editor.d_menu_item_idx) {
                    graphics_draw_rect(mx + 8, item_y - 1, mw - 16, 11, 0x3389DCEB);
                }
                graphics_draw_text(mx + 14, item_y, S_OPERATOR_ITEMS[item_i], col);
                item_y += 13;
            }
        } else if (s_editor.d_menu_category == 3) { // NUMBERS
            for (int k = 0; k < 6; k++) {
                int item_i = start_item + k;
                if (item_i >= NUMBER_ITEMS_COUNT) break;
                uint32_t col = (item_i == s_editor.d_menu_item_idx) ? COLOR_NUMBER : 0x88CDD6F4;
                if (item_i == s_editor.d_menu_item_idx) {
                    graphics_draw_rect(mx + 8, item_y - 1, mw - 16, 11, 0x33FAB387);
                }
                graphics_draw_text(mx + 14, item_y, S_NUMBER_ITEMS[item_i], col);
                item_y += 13;
            }
        } else { // VARIABLES
            char var_items[64][32];
            int vcount = get_variable_menu_items(var_items);
            for (int k = 0; k < 6; k++) {
                int item_i = start_item + k;
                if (item_i >= vcount) break;
                uint32_t col = (item_i == s_editor.d_menu_item_idx) ? COLOR_ACCENT : 0x88CDD6F4;
                if (item_i == s_editor.d_menu_item_idx) {
                    graphics_draw_rect(mx + 8, item_y - 1, mw - 16, 11, 0x33CBA6F7);
                }
                char vbuf[64];
                if (item_i == 0) {
                    snprintf(vbuf, sizeof(vbuf), "* %.48s", var_items[item_i]);
                } else if (item_i < VAR_BASE_COUNT) {
                    snprintf(vbuf, sizeof(vbuf), "%.40s (preset)", var_items[item_i]);
                } else {
                    snprintf(vbuf, sizeof(vbuf), "$ %.48s", var_items[item_i]);
                }
                graphics_draw_text(mx + 14, item_y, vbuf, col);
                item_y += 13;
            }
        }

        graphics_draw_text(mx + 8, my + mh - 13, "[X]/^: Insert  (O): Cancel", 0x66CDD6F4);
    }

    // 6. System Menu Modal Overlay (when open)
    if (s_editor.modal == MODAL_SYS_MENU) {
        int mw = 260;
        int mh = 160;
        int mx = (SCREEN_WIDTH - mw) / 2;
        int my = (SCREEN_HEIGHT - mh) / 2;

        graphics_draw_rect(mx, my, mw, mh, 0xFF181825);
        graphics_draw_rect_outline(mx, my, mw, mh, COLOR_ACCENT);

        // Header
        graphics_draw_text(mx + 8, my + 6, "SYSTEM MENU", COLOR_ACCENT);
        graphics_draw_line(mx, my + 18, mx + mw, my + 18, 0x44FFFFFF);

        // Category Tab
        const char* tab_names[] = { "PRESETS", "FILES", "NEW PROGRAM", "SETTINGS" };
        char tab_text[64];
        snprintf(tab_text, sizeof(tab_text), "< Tab %d/4: %s >", s_editor.sys_menu_tab + 1, tab_names[s_editor.sys_menu_tab]);
        graphics_draw_text(mx + 12, my + 24, tab_text, COLOR_NUMBER);
        graphics_draw_line(mx + 8, my + 36, mx + mw - 8, my + 36, 0x33FFFFFF);

        int item_y = my + 42;
        if (s_editor.sys_menu_tab == 0) { // Presets Tab
            for (int k = 0; k < (int)PRESET_COUNT; k++) {
                uint32_t col = (k == s_editor.sys_menu_idx) ? COLOR_ACCENT : 0x88CDD6F4;
                if (k == s_editor.sys_menu_idx) {
                    graphics_draw_rect(mx + 8, item_y - 1, mw - 16, 11, 0x33CBA6F7);
                }
                char pbuf[64];
                snprintf(pbuf, sizeof(pbuf), "%s%d. %s", (k == s_preset_index) ? "* " : "  ", k + 1, S_PRESET_NAMES[k]);
                graphics_draw_text(mx + 14, item_y, pbuf, col);
                item_y += 14;
            }
        } else if (s_editor.sys_menu_tab == 1) { // Files Tab
            int start_item = (s_editor.sys_menu_idx >= 5) ? s_editor.sys_menu_idx - 4 : 0;
            int total_items = 2 + s_editor.file_list_count;
            for (int k = 0; k < 6; k++) {
                int item_i = start_item + k;
                if (item_i >= total_items) break;
                uint32_t col = (item_i == s_editor.sys_menu_idx) ? COLOR_SAMPLE : 0x88CDD6F4;
                if (item_i == s_editor.sys_menu_idx) {
                    graphics_draw_rect(mx + 8, item_y - 1, mw - 16, 11, 0x33A6E3A1);
                }
                char fbuf[64];
                if (item_i == 0) {
                    snprintf(fbuf, sizeof(fbuf), "[+] Save (last_saved.txt)");
                } else if (item_i == 1) {
                    char next_slot[32];
                    storage_get_next_slot_name(next_slot, sizeof(next_slot));
                    snprintf(fbuf, sizeof(fbuf), "[+] Save As (%s)", next_slot);
                } else {
                    int f_idx = item_i - 2;
                    snprintf(fbuf, sizeof(fbuf), "[-] Open: %s", s_editor.file_list[f_idx]);
                }
                graphics_draw_text(mx + 14, item_y, fbuf, col);
                item_y += 13;
            }
        } else if (s_editor.sys_menu_tab == 2) { // New Program Tab
            graphics_draw_text(mx + 14, item_y + 8, "Create Blank Program Canvas?", COLOR_TEXT);
            graphics_draw_text(mx + 14, item_y + 24, "Existing code will be cleared.", 0x88CDD6F4);
            uint32_t col = (s_editor.sys_menu_idx == 0) ? COLOR_ACCENT : 0x88CDD6F4;
            graphics_draw_rect(mx + 14, item_y + 46, mw - 28, 14, 0x33CBA6F7);
            graphics_draw_rect_outline(mx + 14, item_y + 46, mw - 28, 14, COLOR_ACCENT);
            graphics_draw_text(mx + 20, item_y + 49, "[ Confirm: New Blank Program ]", col);
        } else { // Settings Tab
            graphics_draw_text(mx + 14, item_y + 6, "DISPLAY & PERFORMANCE:", COLOR_ACCENT);
            uint32_t col = (s_editor.sys_menu_idx == 0) ? COLOR_ACCENT : 0x88CDD6F4;
            graphics_draw_rect(mx + 12, item_y + 26, mw - 24, 18, 0x33CBA6F7);
            graphics_draw_rect_outline(mx + 12, item_y + 26, mw - 24, 18, COLOR_ACCENT);
            char sbuf[64];
            snprintf(sbuf, sizeof(sbuf), "Visualizer: %s (Press [X])", s_editor.hide_visualizer ? "[HIDDEN]" : "[SHOWN]");
            graphics_draw_text(mx + 18, item_y + 31, sbuf, col);
            graphics_draw_text(mx + 14, item_y + 54, s_editor.hide_visualizer 
                ? "Full-width code editor canvas active." 
                : "Live note animations & rhythm visualizer on.", 0x88CDD6F4);
            graphics_draw_text(mx + 14, item_y + 68, "Hiding viz maximizes CPU speed on PSP.", 0x66CDD6F4);
        }

        graphics_draw_text(mx + 8, my + mh - 13, "[X]/^: Select  (O)/SEL: Close", 0x66CDD6F4);
    }
}

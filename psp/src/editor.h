#ifndef SHIFT_EDITOR_H
#define SHIFT_EDITOR_H

#include "parser.h"
#include <stdbool.h>

#define CODE_BUFFER_SIZE 4096

typedef enum {
    MODAL_NONE = 0,
    MODAL_D_MENU,     // Token creation menu (Circle)
    MODAL_SYS_MENU    // System menu (Select): Presets, Open, Save, New
} EditorModal;

typedef struct {
    char code[CODE_BUFFER_SIZE];
    Program program;
    int selected_token_idx;
    bool cursor_after_token; // true when caret is positioned to the right of selected token
    int caret_frame;         // blink frame counter
    bool is_holding_cross;

    // Modals
    EditorModal modal;
    bool is_d_menu_open; // for backward compatibility
    int d_menu_category; // 0: Keywords, 1: Samples, 2: Operators, 3: Numbers, 4: Variables
    int d_menu_item_idx;
    int custom_var_count;
    char custom_vars[16][32];

    int sys_menu_tab;    // 0: Presets, 1: Files, 2: New Program, 3: Settings
    int sys_menu_idx;
    int file_list_count;
    char file_list[64][64];

    // Settings
    bool hide_visualizer;

    // Notification toast banner
    char notification[128];
    float notification_timer;

    int cursor_line;
    int cursor_col;
    int scroll_y;
    int scroll_x;
} EditorState;

void editor_init(const char* initial_code);
void editor_update(float dt);
void editor_render(void);
void editor_load_preset(int preset_idx);
void editor_new_program(void);
bool editor_save_current(void);
bool editor_open_file(const char* filename);
const char* editor_get_code(void);
Program* editor_get_program(void);

// Input handling from PSP buttons or SDL keyboard
typedef struct {
    bool up, down, left, right;
    bool triangle, circle, cross, square;
    bool l_trigger, r_trigger;
    bool start, select;
} ControllerInput;

void editor_handle_input(ControllerInput input, ControllerInput prev_input);

#endif // SHIFT_EDITOR_H

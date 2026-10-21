#ifndef SHIFT_INTERPRETER_H
#define SHIFT_INTERPRETER_H

#include "parser.h"
#include <stdbool.h>

void interpreter_init(void);
void interpreter_set_program(Program* prog);
void interpreter_tick(float dt);
void interpreter_toggle_play(void);
void interpreter_set_playing(bool playing);
bool interpreter_is_playing(void);
float interpreter_get_bpm(void);
void interpreter_set_bpm(float bpm);

#endif // SHIFT_INTERPRETER_H

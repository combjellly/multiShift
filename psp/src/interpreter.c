#include "interpreter.h"
#include "audio.h"
#include "visualizer.h"
#include <string.h>
#include <stdlib.h>
#include <math.h>

static Program* s_current_prog = NULL;
static bool s_is_playing = false;
static float s_bpm = 120.0f;
static float s_current_bpm = 120.0f;

void interpreter_init(void) {
    s_current_prog = NULL;
    s_is_playing = false;
    s_bpm = 120.0f;
    s_current_bpm = 120.0f;
}

void interpreter_set_program(Program* prog) {
    s_current_prog = prog;
}

void interpreter_toggle_play(void) {
    s_is_playing = !s_is_playing;
}

void interpreter_set_playing(bool playing) {
    s_is_playing = playing;
}

bool interpreter_is_playing(void) {
    return s_is_playing;
}

float interpreter_get_bpm(void) {
    return s_current_bpm;
}

void interpreter_set_bpm(float bpm) {
    if (bpm > 20.0f && bpm < 400.0f) {
        s_bpm = bpm;
        s_current_bpm = bpm;
    }
}

void interpreter_tick(float dt) {
    if (!s_is_playing || !s_current_prog) return;

    // Default 120 BPM, dynamically adjusted if user defines 'bpm' or 'tempo' variable
    float bpm = s_bpm;
    Variable* v_bpm = parser_get_var_obj(s_current_prog, "bpm");
    Variable* v_tempo = parser_get_var_obj(s_current_prog, "tempo");
    if (v_bpm && v_bpm->value > 0.0f) {
        bpm = v_bpm->value;
    } else if (v_tempo && v_tempo->value > 0.0f) {
        if (v_tempo->value >= 20.0f) {
            bpm = v_tempo->value;
        } else {
            // Relative speed factor: 1.0 = 120 BPM, 1.5 = 180 BPM, 2.0 = 240 BPM, 0.5 = 60 BPM
            bpm = 120.0f * v_tempo->value;
        }
    }
    if (bpm < 20.0f) bpm = 20.0f;
    if (bpm > 600.0f) bpm = 600.0f;
    s_current_bpm = bpm;

    // Shift standard: 1 cycle = 1 beat = (60 / BPM) seconds. At 120 BPM, 1 cycle = 0.5s.
    float sec_per_cycle = 60.0f / bpm;

    for (int i = 0; i < s_current_prog->loop_count; i++) {
        Loop* loop = &s_current_prog->loops[i];
        if (loop->is_commented || loop->action_count == 0) continue;

        // Dynamically re-evaluate loop interval in terms of cycle duration
        if (loop->interval_expr[0] != '\0') {
            float cycle_val = parser_eval_expr(s_current_prog, loop->interval_expr);
            if (cycle_val > 0.001f) {
                loop->interval = cycle_val * sec_per_cycle;
            }
        }

        loop->timer += dt;
        if (loop->timer >= loop->interval) {
            loop->timer -= loop->interval;
            if (loop->timer > loop->interval) loop->timer = 0.0f; // prevent spiraling

            // Execute loop actions in sequential order
            for (int a = 0; a < loop->action_count; a++) {
                Action* act = &loop->actions[a];

                switch (act->type) {
                    case ACTION_ASSIGN: {
                        float val = parser_eval_expr(s_current_prog, act->assign_expr);
                        parser_set_var(s_current_prog, act->target, val);
                        break;
                    }

                    case ACTION_ASSIGN_SEQ: {
                        Variable* v = parser_get_var_obj(s_current_prog, act->target);
                        if (!v && s_current_prog->var_count < MAX_VARIABLES) {
                            v = &s_current_prog->vars[s_current_prog->var_count++];
                            strncpy(v->name, act->target, 31);
                            v->name[31] = '\0';
                        }
                        if (v) {
                            v->seq_count = act->seq_count;
                            for (int k = 0; k < act->seq_count; k++) {
                                v->seq[k] = act->seq_values[k];
                            }
                            if (v->seq_count > 0) v->value = v->seq[0];
                        }
                        break;
                    }

                    case ACTION_IF: {
                        float cur = parser_get_var(s_current_prog, act->cond_var, 0.0f);
                        float target = parser_eval_expr(s_current_prog, act->cond_val_expr);
                        bool cond_met = false;

                        if (strcmp(act->cond_op, "==") == 0) cond_met = (fabsf(cur - target) < 0.0001f);
                        else if (strcmp(act->cond_op, "!=") == 0) cond_met = (fabsf(cur - target) >= 0.0001f);
                        else if (strcmp(act->cond_op, ">=") == 0) cond_met = (cur >= target - 0.0001f);
                        else if (strcmp(act->cond_op, "<=") == 0) cond_met = (cur <= target + 0.0001f);
                        else if (strcmp(act->cond_op, ">") == 0) cond_met = (cur > target + 0.0001f);
                        else if (strcmp(act->cond_op, "<") == 0) cond_met = (cur < target - 0.0001f);

                        if (cond_met) {
                            float sub_val = parser_eval_expr(s_current_prog, act->sub_val_expr);
                            parser_set_var(s_current_prog, act->sub_var, sub_val);
                        }
                        break;
                    }

                    case ACTION_PLAY_SYNTH: {
                        float raw_gain = parser_eval_expr(s_current_prog, act->gain_expr);
                        if (raw_gain > 0.01f) {
                            float raw_note = parser_eval_expr(s_current_prog, act->note_expr);
                            float g = raw_gain / 100.0f;
                            if (g < 0.0f) g = 0.0f;
                            if (g > 1.2f) g = 1.2f;
                            float gain = g * g * 0.8f;
                            float duration = loop->interval * 0.9f;
                            audio_trigger_synth(loop->id, raw_note, gain, duration, OSC_SAW);
                            visualizer_trigger_note(loop->id, raw_note, gain, "synth");
                        }
                        break;
                    }

                    case ACTION_PLAY_SAMPLE: {
                        float raw_gain = parser_eval_expr(s_current_prog, act->gain_expr);
                        if (raw_gain > 0.01f) {
                            float raw_note = parser_eval_expr(s_current_prog, act->note_expr);
                            float var_val = 0.0f;
                            if (act->variant_expr[0] != '\0') {
                                var_val = parser_eval_expr(s_current_prog, act->variant_expr);
                            }
                            int variant_idx = (int)roundf(var_val);

                            int sample_idx = audio_find_sample_variant(act->target, variant_idx);
                            if (sample_idx < 0) {
                                sample_idx = act->sample_idx;
                            }

                            float effective_note = raw_note;
                            if (audio_count_sample_variants(act->target) <= 1) {
                                effective_note += var_val;
                            }

                            float pan = 50.0f;
                            if (act->pan_expr[0] != '\0') {
                                pan = parser_eval_expr(s_current_prog, act->pan_expr);
                            }

                            int cut_group = 0;
                            if (act->cut_expr[0] != '\0') {
                                cut_group = (int)roundf(parser_eval_expr(s_current_prog, act->cut_expr));
                            }

                            // Match WebDirt's natural perceptual volume curve
                            // Prevents multiple simultaneous drum hits from over-saturating the master mix
                            float g = raw_gain / 100.0f;
                            if (g < 0.0f) g = 0.0f;
                            if (g > 1.5f) g = 1.5f;
                            float gain = g * g * (g * 0.6f + 0.4f);

                            audio_trigger_sample(loop->id, sample_idx, effective_note, gain, pan, cut_group);
                            visualizer_trigger_note(loop->id, effective_note, gain, act->target);
                        }
                        break;
                    }
                }
            }
        }
    }
}

#include "visualizer.h"
#include "graphics.h"
#include "audio.h"
#include <string.h>
#include <stdio.h>

static VizBand s_bands[MAX_VIZ_BANDS];
static VizPulse s_pulses[MAX_VIZ_PULSES];

static const uint32_t S_LOOP_COLORS[] = {
    0xFFCBA6F7, // Mauve
    0xFF89DCEB, // Sky
    0xFFA6E3A1, // Green
    0xFFFAB387, // Peach
    0xFFF38BA8, // Red
    0xFFF9E2AF, // Yellow
    0xFFB4BEFE, // Lavender
    0xFF94E2D5  // Teal
};

void visualizer_init(void) {
    memset(s_bands, 0, sizeof(s_bands));
    memset(s_pulses, 0, sizeof(s_pulses));
}

void visualizer_trigger_note(int loop_id, float note, float gain, const char* label) {
    if (loop_id < 0 || loop_id >= MAX_VIZ_BANDS) loop_id = loop_id % MAX_VIZ_BANDS;

    VizBand* b = &s_bands[loop_id];
    b->active = true;
    b->loop_id = loop_id;
    if (label && label[0] != '\0') {
        strncpy(b->label, label, sizeof(b->label) - 1);
        b->label[sizeof(b->label) - 1] = '\0';
    }
    // High energy flash on note trigger
    b->alpha = 1.0f;

    if (gain < 0.05f) return; // Skip pulse for inaudible ghost notes

    // Trigger dynamic note ring animation
    int pulse_idx = -1;
    for (int i = 0; i < MAX_VIZ_PULSES; i++) {
        if (!s_pulses[i].active) {
            pulse_idx = i;
            break;
        }
    }
    if (pulse_idx == -1) pulse_idx = 0;

    VizPulse* p = &s_pulses[pulse_idx];
    p->active = true;
    p->loop_id = loop_id;
    int band_y = 44 + loop_id * 22;
    p->y = (float)band_y;
    p->x = 422.0f;
    p->radius = 2.0f;
    p->max_radius = 6.0f + gain * 8.0f;
    if (p->max_radius > 16.0f) p->max_radius = 16.0f;
    p->alpha = 1.0f;
    p->color = S_LOOP_COLORS[loop_id % 8];
}

void visualizer_update(float dt) {
    for (int i = 0; i < MAX_VIZ_BANDS; i++) {
        if (s_bands[i].active) {
            s_bands[i].alpha -= dt * 2.8f;
            if (s_bands[i].alpha < 0.0f) s_bands[i].alpha = 0.0f;
        }
    }

    for (int i = 0; i < MAX_VIZ_PULSES; i++) {
        if (s_pulses[i].active) {
            s_pulses[i].radius += dt * 36.0f;
            s_pulses[i].alpha -= dt * 2.6f;
            if (s_pulses[i].alpha <= 0.0f || s_pulses[i].radius >= s_pulses[i].max_radius) {
                s_pulses[i].active = false;
            }
        }
    }
}

void visualizer_render(void) {
    // Solid background frame card on right side of screen
    graphics_draw_rect(320, 16, 154, SCREEN_HEIGHT - 32, 0xFF11111B);
    graphics_draw_rect_outline(320, 16, 154, SCREEN_HEIGHT - 32, 0xFF45475A);
    graphics_draw_text(326, 20, "LIVE VIZ", 0xFFCDD6F4);

    // 1. Draw track bands with note occurrence flash bars
    for (int i = 0; i < MAX_VIZ_BANDS; i++) {
        if (!s_bands[i].active) continue;
        int y = 44 + i * 22;
        if (y > SCREEN_HEIGHT - 38) break;

        uint32_t track_col = S_LOOP_COLORS[i % 8];

        // Track baseline
        graphics_draw_line(326, y, 468, y, 0xFF2A2B3D);

        // Flash bar when note occurs (pure rhythm animation)
        if (s_bands[i].alpha > 0.05f) {
            int bar_w = (int)(s_bands[i].alpha * 50.0f);
            if (bar_w > 50) bar_w = 50;
            // Draw glowing trigger pulse on the track line
            graphics_draw_rect(422 - bar_w / 2, y - 2, bar_w, 4, track_col);
            graphics_draw_circle(422, y, 3, 0xFFFFFFFF);
        } else {
            // Resting indicator dot
            graphics_draw_circle(422, y, 2, 0xFF45475A);
        }

        // Instrument label (brightens on trigger)
        uint32_t text_col = (s_bands[i].alpha > 0.3f) ? track_col : 0xFF888B9E;
        char text[16];
        snprintf(text, sizeof(text), "%.9s", s_bands[i].label);
        graphics_draw_text(328, y - 8, text, text_col);
    }

    // 2. Draw note occurrence expanding shockwave rings
    for (int i = 0; i < MAX_VIZ_PULSES; i++) {
        if (!s_pulses[i].active || s_pulses[i].alpha <= 0.05f) continue;
        uint32_t a = (uint32_t)(s_pulses[i].alpha * 255.0f);
        if (a > 255) a = 255;
        uint32_t col = (a << 24) | (s_pulses[i].color & 0x00FFFFFF);

        graphics_draw_circle_outline((int)s_pulses[i].x, (int)s_pulses[i].y, (int)s_pulses[i].radius, col);
    }

    // 3. Mini VU meter bar at bottom of card
    float peak = audio_get_master_volume();
    int vu_w = (int)(peak * 138.0f);
    if (vu_w > 138) vu_w = 138;
    graphics_draw_line(328, SCREEN_HEIGHT - 22, 466, SCREEN_HEIGHT - 22, 0xFF2A2B3D);
    if (vu_w > 0) {
        graphics_draw_rect(328, SCREEN_HEIGHT - 24, vu_w, 3, 0xFFFAB387);
    }
}

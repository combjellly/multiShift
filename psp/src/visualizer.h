#ifndef SHIFT_VISUALIZER_H
#define SHIFT_VISUALIZER_H

#include <stdint.h>
#include <stdbool.h>

#define MAX_VIZ_BANDS 8
#define MAX_VIZ_PULSES 24

typedef struct {
    int loop_id;
    char label[32];
    float last_note;
    float current_y;
    float target_y;
    float alpha;
    bool active;
} VizBand;

typedef struct {
    bool active;
    int loop_id;
    float x;
    float y;
    float radius;
    float max_radius;
    float alpha;
    float note;
    uint32_t color;
} VizPulse;

void visualizer_init(void);
void visualizer_trigger_note(int loop_id, float note, float gain, const char* label);
void visualizer_update(float dt);
void visualizer_render(void);

#endif // SHIFT_VISUALIZER_H

#ifndef SHIFT_GRAPHICS_H
#define SHIFT_GRAPHICS_H

#include <stdint.h>
#include <stdbool.h>

#define SCREEN_WIDTH 480
#define SCREEN_HEIGHT 272

// Cyberpunk / Catppuccin color definitions (0xAARRGGBB)
#define COLOR_BG          0xFF1E1E2E
#define COLOR_TEXT        0xFFCDD6F4
#define COLOR_ACCENT      0xFFCBA6F7 // Lavender
#define COLOR_NUMBER      0xFFFAB387 // Peach
#define COLOR_OPERATOR    0xFF89DCEB // Sky
#define COLOR_SAMPLE      0xFFA6E3A1 // Green
#define COLOR_COMMENT     0xFF6C7086 // Overlay
#define COLOR_SELECTED    0xFF8839EF // Bright Purple
#define COLOR_SCRUBBING   0xFFF38BA8 // Pink/Red pulse
#define COLOR_HUD_BG      0xFF11111B // Opaque dark

void graphics_init(void);
void graphics_shutdown(void);
void graphics_clear(uint32_t color);
void graphics_flip(void);

// Drawing primitives
void graphics_draw_pixel(int x, int y, uint32_t color);
void graphics_draw_line(int x0, int y0, int x1, int y1, uint32_t color);
void graphics_draw_rect(int x, int y, int w, int h, uint32_t color);
void graphics_draw_rect_outline(int x, int y, int w, int h, uint32_t color);
void graphics_draw_circle(int cx, int cy, int radius, uint32_t color);
void graphics_draw_circle_outline(int cx, int cy, int radius, uint32_t color);

// Text rendering using embedded 8x8 monospaced font
void graphics_draw_char(int x, int y, char c, uint32_t color);
void graphics_draw_text(int x, int y, const char* text, uint32_t color);

#endif // SHIFT_GRAPHICS_H

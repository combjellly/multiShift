#include "graphics.h"
#include <string.h>
#include <stdlib.h>
#include <math.h>

#ifdef __PSP__
#include <pspkernel.h>
#include <pspdisplay.h>
#include <pspgu.h>

#define FRAME_BUFFER_SIZE (512 * 272 * sizeof(uint32_t))

// Fast CPU rendering into CACHED VRAM (0x04000000 - KSEG0)
// Hits L1 data cache at full 333MHz speed with zero bus stalls
static uint32_t* s_vram_draw_buffers[2] = {
    (uint32_t*)0x04000000,
    (uint32_t*)(0x04000000 + FRAME_BUFFER_SIZE)
};

// Hardware display scanout in UNCACHED VRAM (0x44000000 - KSEG1)
static void* s_vram_disp_buffers[2] = {
    (void*)0x44000000,
    (void*)(0x44000000 + FRAME_BUFFER_SIZE)
};

static int s_draw_buf_idx = 1; // Initially draw to buffer 1 while buffer 0 is displayed
#define CURRENT_DRAW_BUFFER (s_vram_draw_buffers[s_draw_buf_idx])
#elif defined(USE_SDL)
#include <SDL.h>
static SDL_Window* s_window = NULL;
static SDL_Renderer* s_renderer = NULL;
static SDL_Texture* s_texture = NULL;
static uint32_t s_pixel_buffer[SCREEN_WIDTH * SCREEN_HEIGHT];
#endif

// 8x8 bitmap font (ASCII 32 to 126)
static const uint8_t FONT_8X8[95][8] = {
    {0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00}, // 32 ' '
    {0x18,0x3C,0x3C,0x18,0x18,0x00,0x18,0x00}, // 33 '!'
    {0x66,0x66,0x24,0x00,0x00,0x00,0x00,0x00}, // 34 '"'
    {0x6C,0x6C,0xFE,0x6C,0xFE,0x6C,0x6C,0x00}, // 35 '#'
    {0x18,0x3E,0x60,0x3C,0x06,0x7C,0x18,0x00}, // 36 '$'
    {0x00,0x66,0xA6,0xD8,0x1B,0x65,0x66,0x00}, // 37 '%'
    {0x30,0x48,0x30,0x6E,0xD9,0x89,0x76,0x00}, // 38 '&'
    {0x18,0x18,0x08,0x00,0x00,0x00,0x00,0x00}, // 39 '''
    {0x0C,0x18,0x30,0x30,0x30,0x18,0x0C,0x00}, // 40 '('
    {0x30,0x18,0x0C,0x0C,0x0C,0x18,0x30,0x00}, // 41 ')'
    {0x00,0x66,0x3C,0xFF,0x3C,0x66,0x00,0x00}, // 42 '*'
    {0x00,0x18,0x18,0x7E,0x18,0x18,0x00,0x00}, // 43 '+'
    {0x00,0x00,0x00,0x00,0x00,0x18,0x18,0x30}, // 44 ','
    {0x00,0x00,0x00,0x7E,0x00,0x00,0x00,0x00}, // 45 '-'
    {0x00,0x00,0x00,0x00,0x00,0x18,0x18,0x00}, // 46 '.'
    {0x03,0x06,0x0C,0x18,0x30,0x60,0x40,0x00}, // 47 '/'
    {0x3C,0x66,0x6E,0x76,0x66,0x66,0x3C,0x00}, // 48 '0'
    {0x18,0x18,0x38,0x18,0x18,0x18,0x7E,0x00}, // 49 '1'
    {0x3C,0x66,0x06,0x0C,0x18,0x30,0x7E,0x00}, // 50 '2'
    {0x3C,0x66,0x06,0x1C,0x06,0x66,0x3C,0x00}, // 51 '3'
    {0x0C,0x1C,0x3C,0x6C,0xFE,0x0C,0x0C,0x00}, // 52 '4'
    {0x7E,0x60,0x7C,0x06,0x06,0x66,0x3C,0x00}, // 53 '5'
    {0x3C,0x66,0x60,0x7C,0x66,0x66,0x3C,0x00}, // 54 '6'
    {0x7E,0x06,0x0C,0x18,0x30,0x30,0x30,0x00}, // 55 '7'
    {0x3C,0x66,0x66,0x3C,0x66,0x66,0x3C,0x00}, // 56 '8'
    {0x3C,0x66,0x66,0x3E,0x06,0x66,0x3C,0x00}, // 57 '9'
    {0x00,0x18,0x18,0x00,0x18,0x18,0x00,0x00}, // 58 ':'
    {0x00,0x18,0x18,0x00,0x18,0x18,0x30,0x00}, // 59 ';'
    {0x06,0x0C,0x18,0x30,0x18,0x0C,0x06,0x00}, // 60 '<'
    {0x00,0x7E,0x00,0x7E,0x00,0x00,0x00,0x00}, // 61 '='
    {0x60,0x30,0x18,0x0C,0x18,0x30,0x60,0x00}, // 62 '>'
    {0x3C,0x66,0x06,0x0C,0x18,0x00,0x18,0x00}, // 63 '?'
    {0x3C,0x42,0x99,0xA5,0xA5,0x9D,0x42,0x3C}, // 64 '@'
    {0x18,0x24,0x42,0x42,0x7E,0x42,0x42,0x00}, // 65 'A'
    {0x7C,0x42,0x42,0x7C,0x42,0x42,0x7C,0x00}, // 66 'B'
    {0x3C,0x42,0x40,0x40,0x40,0x42,0x3C,0x00}, // 67 'C'
    {0x78,0x44,0x42,0x42,0x42,0x44,0x78,0x00}, // 68 'D'
    {0x7E,0x40,0x40,0x78,0x40,0x40,0x7E,0x00}, // 69 'E'
    {0x7E,0x40,0x40,0x78,0x40,0x40,0x40,0x00}, // 70 'F'
    {0x3C,0x42,0x40,0x4E,0x42,0x42,0x3C,0x00}, // 71 'G'
    {0x42,0x42,0x42,0x7E,0x42,0x42,0x42,0x00}, // 72 'H'
    {0x3C,0x18,0x18,0x18,0x18,0x18,0x3C,0x00}, // 73 'I'
    {0x06,0x06,0x06,0x06,0x06,0x46,0x3C,0x00}, // 74 'J'
    {0x44,0x48,0x50,0x60,0x50,0x48,0x44,0x00}, // 75 'K'
    {0x40,0x40,0x40,0x40,0x40,0x40,0x7E,0x00}, // 76 'L'
    {0x81,0xC3,0xA5,0x99,0x81,0x81,0x81,0x00}, // 77 'M'
    {0x42,0x62,0x52,0x4A,0x46,0x42,0x42,0x00}, // 78 'N'
    {0x3C,0x42,0x42,0x42,0x42,0x42,0x3C,0x00}, // 79 'O'
    {0x7C,0x42,0x42,0x7C,0x40,0x40,0x40,0x00}, // 80 'P'
    {0x3C,0x42,0x42,0x42,0x4A,0x44,0x3A,0x00}, // 81 'Q'
    {0x7C,0x42,0x42,0x7C,0x48,0x44,0x42,0x00}, // 82 'R'
    {0x3C,0x42,0x40,0x3C,0x02,0x42,0x3C,0x00}, // 83 'S'
    {0x7E,0x18,0x18,0x18,0x18,0x18,0x18,0x00}, // 84 'T'
    {0x42,0x42,0x42,0x42,0x42,0x42,0x3C,0x00}, // 85 'U'
    {0x42,0x42,0x42,0x42,0x24,0x24,0x18,0x00}, // 86 'V'
    {0x81,0x81,0x81,0x99,0xA5,0xC3,0x81,0x00}, // 87 'W'
    {0x42,0x24,0x18,0x18,0x24,0x42,0x42,0x00}, // 88 'X'
    {0x42,0x42,0x24,0x18,0x18,0x18,0x18,0x00}, // 89 'Y'
    {0x7E,0x02,0x04,0x08,0x10,0x20,0x7E,0x00}, // 90 'Z'
    {0x1C,0x10,0x10,0x10,0x10,0x10,0x1C,0x00}, // 91 '['
    {0x40,0x20,0x10,0x08,0x04,0x02,0x01,0x00}, // 92 '\'
    {0x38,0x08,0x08,0x08,0x08,0x08,0x38,0x00}, // 93 ']'
    {0x08,0x14,0x22,0x00,0x00,0x00,0x00,0x00}, // 94 '^'
    {0x00,0x00,0x00,0x00,0x00,0x00,0xFF,0x00}, // 95 '_'
    {0x08,0x04,0x02,0x00,0x00,0x00,0x00,0x00}, // 96 '`'
    {0x00,0x00,0x3C,0x02,0x3E,0x46,0x3B,0x00}, // 97 'a'
    {0x40,0x40,0x7C,0x42,0x42,0x42,0x7C,0x00}, // 98 'b'
    {0x00,0x00,0x3C,0x42,0x40,0x42,0x3C,0x00}, // 99 'c'
    {0x02,0x02,0x3E,0x42,0x42,0x42,0x3E,0x00}, // 100 'd'
    {0x00,0x00,0x3C,0x42,0x7E,0x40,0x3C,0x00}, // 101 'e'
    {0x0C,0x12,0x10,0x38,0x10,0x10,0x10,0x00}, // 102 'f'
    {0x00,0x00,0x3A,0x46,0x46,0x3E,0x02,0x3C}, // 103 'g'
    {0x40,0x40,0x5C,0x62,0x42,0x42,0x42,0x00}, // 104 'h'
    {0x18,0x00,0x38,0x18,0x18,0x18,0x3C,0x00}, // 105 'i'
    {0x06,0x00,0x06,0x06,0x06,0x46,0x3C,0x00}, // 106 'j'
    {0x40,0x40,0x44,0x48,0x70,0x48,0x44,0x00}, // 107 'k'
    {0x38,0x18,0x18,0x18,0x18,0x18,0x3C,0x00}, // 108 'l'
    {0x00,0x00,0x66,0x99,0x99,0x99,0x99,0x00}, // 109 'm'
    {0x00,0x00,0x5C,0x62,0x42,0x42,0x42,0x00}, // 110 'n'
    {0x00,0x00,0x3C,0x42,0x42,0x42,0x3C,0x00}, // 111 'o'
    {0x00,0x00,0x7C,0x42,0x42,0x7C,0x40,0x40}, // 112 'p'
    {0x00,0x00,0x3E,0x42,0x42,0x3E,0x02,0x02}, // 113 'q'
    {0x00,0x00,0x5C,0x62,0x40,0x40,0x40,0x00}, // 114 'r'
    {0x00,0x00,0x3E,0x40,0x3C,0x02,0x7C,0x00}, // 115 's'
    {0x10,0x10,0x7C,0x10,0x10,0x12,0x0C,0x00}, // 116 't'
    {0x00,0x00,0x42,0x42,0x42,0x46,0x3B,0x00}, // 117 'u'
    {0x00,0x00,0x42,0x42,0x42,0x24,0x18,0x00}, // 118 'v'
    {0x00,0x00,0x81,0x81,0x99,0x99,0x66,0x00}, // 119 'w'
    {0x00,0x00,0x42,0x24,0x18,0x24,0x42,0x00}, // 120 'x'
    {0x00,0x00,0x42,0x42,0x46,0x3A,0x02,0x3C}, // 121 'y'
    {0x00,0x00,0x7E,0x04,0x08,0x10,0x7E,0x00}, // 122 'z'
    {0x0E,0x18,0x18,0x70,0x18,0x18,0x0E,0x00}, // 123 '{'
    {0x18,0x18,0x18,0x00,0x18,0x18,0x18,0x00}, // 124 '|'
    {0x70,0x18,0x18,0x0E,0x18,0x18,0x70,0x00}, // 125 '}'
    {0x76,0xDC,0x00,0x00,0x00,0x00,0x00,0x00}  // 126 '~'
};

static inline uint32_t blend_color(uint32_t dst, uint32_t src) {
    uint32_t a = (src >> 24) & 0xFF;
    if (a == 255) return src;
    if (a == 0) return dst;

    uint32_t inv_a = 255 - a;
    // Fast bit-shift division approximation: ((val + 1 + (val >> 8)) >> 8) == val / 255
    uint32_t sr = (src >> 16) & 0xFF, sg = (src >> 8) & 0xFF, sb = src & 0xFF;
    uint32_t dr = (dst >> 16) & 0xFF, dg = (dst >> 8) & 0xFF, db = dst & 0xFF;

    uint32_t r = sr * a + dr * inv_a;
    r = (r + 1 + (r >> 8)) >> 8;

    uint32_t g = sg * a + dg * inv_a;
    g = (g + 1 + (g >> 8)) >> 8;

    uint32_t b = sb * a + db * inv_a;
    b = (b + 1 + (b >> 8)) >> 8;

    return (0xFF << 24) | (r << 16) | (g << 8) | b;
}

void graphics_init(void) {
#ifdef __PSP__
    sceDisplaySetMode(0, SCREEN_WIDTH, SCREEN_HEIGHT);
    // Clear both frame buffers initially
    for (int b = 0; b < 2; b++) {
        uint32_t* buf = s_vram_draw_buffers[b];
        for (int i = 0; i < 512 * SCREEN_HEIGHT; i++) {
            buf[i] = COLOR_BG;
        }
    }
    sceKernelDcacheWritebackInvalidateAll();

    // Hardware display initially shows buffer 0
    sceDisplaySetFrameBuf(s_vram_disp_buffers[0], 512, PSP_DISPLAY_PIXEL_FORMAT_8888, PSP_DISPLAY_SETBUF_NEXTFRAME);
    // CPU draws to buffer 1
    s_draw_buf_idx = 1;
#elif defined(USE_SDL)
    s_window = SDL_CreateWindow("Shift PSP (480x272)", 
        SDL_WINDOWPOS_CENTERED, SDL_WINDOWPOS_CENTERED, 
        SCREEN_WIDTH * 2, SCREEN_HEIGHT * 2, SDL_WINDOW_SHOWN);
    s_renderer = SDL_CreateRenderer(s_window, -1, SDL_RENDERER_ACCELERATED | SDL_RENDERER_PRESENTVSYNC);
    s_texture = SDL_CreateTexture(s_renderer, SDL_PIXELFORMAT_ARGB8888, SDL_TEXTUREACCESS_STREAMING, SCREEN_WIDTH, SCREEN_HEIGHT);
    memset(s_pixel_buffer, 0, sizeof(s_pixel_buffer));
#endif
}

void graphics_shutdown(void) {
#ifdef USE_SDL
    if (s_texture) SDL_DestroyTexture(s_texture);
    if (s_renderer) SDL_DestroyRenderer(s_renderer);
    if (s_window) SDL_DestroyWindow(s_window);
#endif
}

void graphics_clear(uint32_t color) {
#ifdef __PSP__
    uint32_t* draw_buf = CURRENT_DRAW_BUFFER;
    for (int y = 0; y < SCREEN_HEIGHT; y++) {
        uint32_t* row = &draw_buf[y * 512];
        for (int x = 0; x < SCREEN_WIDTH; x++) {
            row[x] = color;
        }
    }
#elif defined(USE_SDL)
    for (int i = 0; i < SCREEN_WIDTH * SCREEN_HEIGHT; i++) {
        s_pixel_buffer[i] = color;
    }
#endif
}

void graphics_flip(void) {
#ifdef __PSP__
    // 1. Flush CPU L1 D-Cache so the completed frame is written back to physical EDRAM
    sceKernelDcacheWritebackInvalidateAll();

    // 2. Identify the buffer that was just rendered
    void* finished_disp_buffer = s_vram_disp_buffers[s_draw_buf_idx];

    // 3. Swap draw index so subsequent rendering goes to the now-hidden buffer
    s_draw_buf_idx = 1 - s_draw_buf_idx;

    // 4. Request hardware display controller to latch finished_disp_buffer at next VBLANK
    sceDisplaySetFrameBuf(finished_disp_buffer, 512, PSP_DISPLAY_PIXEL_FORMAT_8888, PSP_DISPLAY_SETBUF_NEXTFRAME);

    // 5. Wait for VBLANK to arrive, confirming the display controller has latched and switched buffers
    sceDisplayWaitVblankStart();
#elif defined(USE_SDL)
    SDL_UpdateTexture(s_texture, NULL, s_pixel_buffer, SCREEN_WIDTH * sizeof(uint32_t));
    SDL_RenderClear(s_renderer);
    SDL_RenderCopy(s_renderer, s_texture, NULL, NULL);
    SDL_RenderPresent(s_renderer);
#endif
}

void graphics_draw_pixel(int x, int y, uint32_t color) {
    if (x < 0 || x >= SCREEN_WIDTH || y < 0 || y >= SCREEN_HEIGHT) return;
    uint32_t a = (color >> 24) & 0xFF;
    if (a == 0) return;

#ifdef __PSP__
    uint32_t* draw_buf = CURRENT_DRAW_BUFFER;
    if (a == 255) {
        draw_buf[y * 512 + x] = color;
    } else {
        draw_buf[y * 512 + x] = blend_color(draw_buf[y * 512 + x], color);
    }
#elif defined(USE_SDL)
    if (a == 255) {
        s_pixel_buffer[y * SCREEN_WIDTH + x] = color;
    } else {
        s_pixel_buffer[y * SCREEN_WIDTH + x] = blend_color(s_pixel_buffer[y * SCREEN_WIDTH + x], color);
    }
#endif
}

void graphics_draw_rect(int x, int y, int w, int h, uint32_t color) {
    if (w <= 0 || h <= 0) return;
    int x0 = x < 0 ? 0 : x;
    int y0 = y < 0 ? 0 : y;
    int x1 = (x + w > SCREEN_WIDTH) ? SCREEN_WIDTH : x + w;
    int y1 = (y + h > SCREEN_HEIGHT) ? SCREEN_HEIGHT : y + h;
    if (x0 >= x1 || y0 >= y1) return;

    uint32_t a = (color >> 24) & 0xFF;
    if (a == 0) return;

    int draw_w = x1 - x0;

#ifdef __PSP__
    uint32_t* draw_buf = CURRENT_DRAW_BUFFER;
    if (a == 255) {
        for (int j = y0; j < y1; j++) {
            uint32_t* row = &draw_buf[j * 512 + x0];
            for (int i = 0; i < draw_w; i++) {
                row[i] = color;
            }
        }
    } else {
        for (int j = y0; j < y1; j++) {
            uint32_t* row = &draw_buf[j * 512 + x0];
            for (int i = 0; i < draw_w; i++) {
                row[i] = blend_color(row[i], color);
            }
        }
    }
#elif defined(USE_SDL)
    if (a == 255) {
        for (int j = y0; j < y1; j++) {
            uint32_t* row = &s_pixel_buffer[j * SCREEN_WIDTH + x0];
            for (int i = 0; i < draw_w; i++) {
                row[i] = color;
            }
        }
    } else {
        for (int j = y0; j < y1; j++) {
            uint32_t* row = &s_pixel_buffer[j * SCREEN_WIDTH + x0];
            for (int i = 0; i < draw_w; i++) {
                row[i] = blend_color(row[i], color);
            }
        }
    }
#endif
}

void graphics_draw_line(int x0, int y0, int x1, int y1, uint32_t color) {
    if (y0 == y1) {
        int start_x = x0 < x1 ? x0 : x1;
        int end_x = x0 < x1 ? x1 : x0;
        graphics_draw_rect(start_x, y0, end_x - start_x + 1, 1, color);
        return;
    }
    if (x0 == x1) {
        int start_y = y0 < y1 ? y0 : y1;
        int end_y = y0 < y1 ? y1 : y0;
        graphics_draw_rect(x0, start_y, 1, end_y - start_y + 1, color);
        return;
    }

    int dx = abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    int dy = -abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    int err = dx + dy, e2;

    while (1) {
        graphics_draw_pixel(x0, y0, color);
        if (x0 == x1 && y0 == y1) break;
        e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
    }
}

void graphics_draw_rect_outline(int x, int y, int w, int h, uint32_t color) {
    graphics_draw_line(x, y, x + w - 1, y, color);
    graphics_draw_line(x, y + h - 1, x + w - 1, y + h - 1, color);
    graphics_draw_line(x, y, x, y + h - 1, color);
    graphics_draw_line(x + w - 1, y, x + w - 1, y + h - 1, color);
}

void graphics_draw_circle(int cx, int cy, int radius, uint32_t color) {
    for (int y = -radius; y <= radius; y++) {
        for (int x = -radius; x <= radius; x++) {
            if (x * x + y * y <= radius * radius) {
                graphics_draw_pixel(cx + x, cy + y, color);
            }
        }
    }
}

void graphics_draw_circle_outline(int cx, int cy, int radius, uint32_t color) {
    int x = radius, y = 0;
    int err = 0;

    while (x >= y) {
        graphics_draw_pixel(cx + x, cy + y, color);
        graphics_draw_pixel(cx + y, cy + x, color);
        graphics_draw_pixel(cx - y, cy + x, color);
        graphics_draw_pixel(cx - x, cy + y, color);
        graphics_draw_pixel(cx - x, cy - y, color);
        graphics_draw_pixel(cx - y, cy - x, color);
        graphics_draw_pixel(cx + y, cy - x, color);
        graphics_draw_pixel(cx + x, cy - y, color);

        if (err <= 0) {
            y += 1;
            err += 2 * y + 1;
        }
        if (err > 0) {
            x -= 1;
            err -= 2 * x + 1;
        }
    }
}

void graphics_draw_char(int x, int y, char c, uint32_t color) {
    if (c < 32 || c > 126) return;
    if (x + 8 <= 0 || x >= SCREEN_WIDTH || y + 8 <= 0 || y >= SCREEN_HEIGHT) return;

    const uint8_t* glyph = FONT_8X8[c - 32];
    uint32_t a = (color >> 24) & 0xFF;
    if (a == 0) return;

#ifdef __PSP__
    uint32_t* draw_buf = CURRENT_DRAW_BUFFER;
    // Fast path: glyph is fully on screen
    if (x >= 0 && x + 8 <= SCREEN_WIDTH && y >= 0 && y + 8 <= SCREEN_HEIGHT) {
        uint32_t* row = &draw_buf[y * 512 + x];
        for (int r = 0; r < 8; r++) {
            uint8_t line = glyph[r];
            if (line) {
                if (line & 0x80) row[0] = color;
                if (line & 0x40) row[1] = color;
                if (line & 0x20) row[2] = color;
                if (line & 0x10) row[3] = color;
                if (line & 0x08) row[4] = color;
                if (line & 0x04) row[5] = color;
                if (line & 0x02) row[6] = color;
                if (line & 0x01) row[7] = color;
            }
            row += 512;
        }
        return;
    }
#elif defined(USE_SDL)
    if (x >= 0 && x + 8 <= SCREEN_WIDTH && y >= 0 && y + 8 <= SCREEN_HEIGHT) {
        uint32_t* row = &s_pixel_buffer[y * SCREEN_WIDTH + x];
        for (int r = 0; r < 8; r++) {
            uint8_t line = glyph[r];
            if (line) {
                if (line & 0x80) row[0] = color;
                if (line & 0x40) row[1] = color;
                if (line & 0x20) row[2] = color;
                if (line & 0x10) row[3] = color;
                if (line & 0x08) row[4] = color;
                if (line & 0x04) row[5] = color;
                if (line & 0x02) row[6] = color;
                if (line & 0x01) row[7] = color;
            }
            row += SCREEN_WIDTH;
        }
        return;
    }
#endif

    // Fallback for partially clipped glyph at screen boundary
    for (int row = 0; row < 8; row++) {
        uint8_t line = glyph[row];
        for (int col = 0; col < 8; col++) {
            if (line & (0x80 >> col)) {
                graphics_draw_pixel(x + col, y + row, color);
            }
        }
    }
}

void graphics_draw_text(int x, int y, const char* text, uint32_t color) {
    if (!text) return;
    int cur_x = x;
    int cur_y = y;

    for (int i = 0; text[i] != '\0'; i++) {
        if (text[i] == '\n') {
            cur_x = x;
            cur_y += 10;
            continue;
        }
        graphics_draw_char(cur_x, cur_y, text[i], color);
        cur_x += 8;
    }
}

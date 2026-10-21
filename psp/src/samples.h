#ifndef SHIFT_SAMPLES_H
#define SHIFT_SAMPLES_H

#include "audio.h"
#include "parser.h"
#include <stdbool.h>

// Initialize sample discovery and populate lightweight catalog (NO audio files loaded into RAM)
void samples_init(void);

// Ensure a sample (and all its variants) is loaded into RAM on-demand
bool samples_ensure_loaded(const char* name);

// Scans an active program AST and loads only samples present in the code into RAM
void samples_load_for_program(const Program* prog);

// Catalog querying (for D-menu and editor without loading audio into RAM)
int samples_get_catalog_count(void);
const char* samples_get_catalog_name(int idx);

#endif // SHIFT_SAMPLES_H

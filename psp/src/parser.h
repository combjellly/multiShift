#ifndef SHIFT_PARSER_H
#define SHIFT_PARSER_H

#include <stdint.h>
#include <stdbool.h>

#define MAX_TOKENS 1024
#define MAX_LOOPS 32
#define MAX_ACTIONS_PER_LOOP 32
#define MAX_VARIABLES 64
#define MAX_SEQ_ITEMS 32

typedef enum {
    TOK_KEYWORD,
    TOK_SAMPLE,
    TOK_SYNTH,
    TOK_NUMBER,
    TOK_OPERATOR,
    TOK_IDENTIFIER,
    TOK_PUNCTUATION,
    TOK_COMMENT,
    TOK_EMPTY_LINE
} TokenType;

typedef struct {
    TokenType type;
    char text[32];
    float num_value;
    int start;
    int end;
    int line;
    int col;
} Token;

typedef enum {
    ACTION_PLAY_SAMPLE,
    ACTION_PLAY_SYNTH,
    ACTION_ASSIGN,
    ACTION_ASSIGN_SEQ,
    ACTION_IF
} ActionType;

typedef struct {
    ActionType type;
    char target[32]; // sample name or var name
    int sample_idx;
    char variant_expr[32];
    char gain_expr[48];
    char note_expr[32];
    char pan_expr[32];
    char cut_expr[32];
    // Assignment expr
    char assign_expr[64];
    // Condition
    char cond_var[32];
    char cond_op[4];
    char cond_val_expr[32];
    char sub_var[32];
    char sub_val_expr[32];
    // Sequence
    float seq_values[MAX_SEQ_ITEMS];
    int seq_count;
} Action;

typedef struct {
    int id;
    char interval_expr[32];
    float interval; // in beats / seconds
    float timer;
    Action actions[MAX_ACTIONS_PER_LOOP];
    int action_count;
    bool is_commented;
} Loop;

typedef struct {
    char name[32];
    float value;
    float seq[MAX_SEQ_ITEMS];
    int seq_count;
    int seq_index;
} Variable;

typedef struct {
    Loop loops[MAX_LOOPS];
    int loop_count;
    Variable vars[MAX_VARIABLES];
    int var_count;
    Token tokens[MAX_TOKENS];
    int token_count;
} Program;

// Tokenizes Shift code string into tokens
int parser_tokenize(const char* code, Token* tokens, int max_tokens);

// Parses tokens / code into an executable Program AST
bool parser_parse(const char* code, Program* prog);

// Helper variable lookup & mutation
float parser_get_var(Program* prog, const char* name, float fallback);
void parser_set_var(Program* prog, const char* name, float val);
Variable* parser_get_var_obj(Program* prog, const char* name);

// Evaluates an expression string in the context of the Program variables
float parser_eval_expr(Program* prog, const char* expr);

// Random variable name generator for D menu
const char* parser_generate_random_var_name(const Program* prog);

#endif // SHIFT_PARSER_H

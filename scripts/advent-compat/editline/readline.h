/* Stand-in for libedit's readline.h when Open Adventure is built for the browser.
 * The terminal (Q-Slodem) does the line editing; the wasm just asks it for a line. */
#ifndef ADVENT_COMPAT_READLINE_H
#define ADVENT_COMPAT_READLINE_H
char *readline(const char *prompt);
static inline int add_history(const char *line) { (void)line; return 0; }
#endif

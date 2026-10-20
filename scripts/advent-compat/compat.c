/* Browser glue for Open Adventure (The Septic Tankz door).
 *
 * readline():  prints the prompt, then asks the page for a line of input. The page answers
 *              asynchronously; Binaryen's asyncify pass lets this C code wait for it.
 * adv_fopen / adv_fclose:  the game's save file lives on the board, not on a disk. Saves are
 *              written to a memory stream and handed to the page; resumes read the page's copy.
 *              (saveresume.c and main.c are compiled with -Dfopen=adv_fopen -Dfclose=adv_fclose.)
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define IMPORT(name) __attribute__((import_module("env"), import_name(name)))
IMPORT("js_readline") int js_readline(char *buf, int max);   /* async: returns length, -1 for EOF */
IMPORT("js_save_size") int js_save_size(void);
IMPORT("js_save_read") void js_save_read(char *buf);
IMPORT("js_save_write") void js_save_write(const char *buf, int len);

#define LINEMAX 1000

char *readline(const char *prompt) {
	if (prompt && *prompt) fputs(prompt, stdout);
	fflush(stdout);
	char *buf = malloc(LINEMAX + 1);
	int n = js_readline(buf, LINEMAX);
	if (n < 0) { free(buf); return NULL; }
	buf[n] = 0;
	return buf;
}

static FILE *wstream;
static char *wbuf;
static size_t wlen;

FILE *adv_fopen(const char *name, const char *mode) {
	(void)name;
	if (mode[0] == 'w') {
		wstream = open_memstream(&wbuf, &wlen);
		return wstream;
	}
	int n = js_save_size();
	if (n <= 0) return NULL;
	char *b = malloc(n);
	js_save_read(b);
	return fmemopen(b, n, "rb");   /* small and short-lived; never freed */
}

int adv_fclose(FILE *f) {
	if (f && f == wstream) {
		int r = fclose(f);
		js_save_write(wbuf, (int)wlen);
		free(wbuf); wbuf = NULL; wlen = 0; wstream = NULL;
		return r;
	}
	return fclose(f);
}

/* Room for asyncify's saved stack, handed to the page. */
__attribute__((export_name("adv_alloc"))) void *adv_alloc(int n) { return malloc(n); }

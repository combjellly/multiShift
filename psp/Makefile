TARGET = shift_psp
OBJS = src/main.o src/audio.o src/samples.o src/parser.o src/interpreter.o src/graphics.o src/visualizer.o src/editor.o src/storage.o

INCDIR = 
CFLAGS = -O2 -G0 -Wall -D__PSP__
CXXFLAGS = $(CFLAGS) -fno-exceptions -fno-rtti
ASFLAGS = $(CFLAGS)

LIBDIR =
LDFLAGS =
LIBS= -lpspaudiolib -lpspaudio -lpspgu -lpspctrl -lpspdisplay -lpsppower -lm

EXTRA_TARGETS = EBOOT.PBP
PSP_EBOOT_TITLE = Shift PSP
# PSP_EBOOT_ICON = ICON0.PNG

PSPSDK=$(shell psp-config --pspsdk-path)
include $(PSPSDK)/lib/build.mak

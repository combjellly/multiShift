import { StreamLanguage } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

export const shiftLanguage = StreamLanguage.define({
  name: "shift",
  startState: () => ({ inComment: false }),
  token(stream, state) {
    if (state.inComment) {
      if (stream.match("-}")) {
        state.inComment = false;
        return "comment";
      }
      stream.next();
      return "comment";
    }

    if (stream.match("{-")) {
      state.inComment = true;
      return "comment";
    }

    if (stream.match("--")) {
      stream.skipToEnd();
      return "comment";
    }

    if (stream.match(/"([^"\\]|\\.)*"/)) {
      return "string";
    }

    if (stream.match(/\b\d+(\.\d+)?\b/)) {
      return "number";
    }

    if (stream.match(/\b(play|if|else|for|every|while|chop)\b/)) {
      return "keyword";
    }

    if (stream.match(/\*|\/|\.|:|==|!=|<=|>=|<|>|=/)) {
      return "operator";
    }

    stream.next();
    return null;
  }
});

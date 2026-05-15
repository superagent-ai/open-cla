"use client";

import * as React from "react";
import { MarkdownPlugin } from "@platejs/markdown";
import { type Value } from "platejs";
import { Plate, usePlateEditor } from "platejs/react";

import { EditorKit } from "@/components/editor/editor-kit";
import { Editor, EditorContainer } from "@/components/ui/editor";

type TemplatePlateEditorProps = {
  initialValue?: Value;
  initialMarkdown?: string;
  onChange: (params: { value: Value; markdown: string }) => void;
};

const FALLBACK_VALUE: Value = [{ type: "p", children: [{ text: "" }] }];

export function TemplatePlateEditor({
  initialValue,
  initialMarkdown,
  onChange
}: TemplatePlateEditorProps) {
  const editor = usePlateEditor({
    plugins: EditorKit,
    value: initialValue ?? FALLBACK_VALUE
  });

  React.useEffect(() => {
    if (initialMarkdown) {
      try {
        const fragment = editor.getApi(MarkdownPlugin).markdown.deserialize(initialMarkdown);
        if (fragment.length > 0) {
          editor.tf.setValue(fragment);
        }
      } catch {
        // Fall back to whatever value the editor was initialized with.
      }
    }

    try {
      const markdown = editor.getApi(MarkdownPlugin).markdown.serialize();
      onChange({ value: editor.children as Value, markdown });
    } catch {
      // Ignore until the markdown plugin is available.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  return (
    <Plate
      editor={editor}
      onChange={({ value }) => {
        let markdown = "";
        try {
          markdown = editor.getApi(MarkdownPlugin).markdown.serialize();
        } catch {
          markdown = "";
        }

        onChange({ value, markdown });
      }}
    >
      <EditorContainer>
        <Editor variant="default" />
      </EditorContainer>
    </Plate>
  );
}

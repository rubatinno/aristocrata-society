"use client";

import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { useEditor, useEditorState, EditorContent } from "@tiptap/react";
import type { EditorView } from "@tiptap/pm/view";
import StarterKit from "@tiptap/starter-kit";
import TiptapLink from "@tiptap/extension-link";
import { TextStyle } from "@tiptap/extension-text-style";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { FontSize } from "@/components/mentee-area/font-size-extension";
import { ResizableImage } from "@/components/mentee-area/resizable-image";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Bold,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  ListTodo,
  Minus,
  Plus,
  Redo2,
  Undo2,
  ZoomIn,
} from "lucide-react";
import { uploadNoteImage } from "@/app/agendar/anotacoes/actions";
import { cn } from "@/lib/utils";

const DEFAULT_FONT_SIZE = 16;
const MIN_FONT_SIZE = 10;
const MAX_FONT_SIZE = 48;

const ZOOM_LEVELS = [50, 75, 90, 100, 110, 125, 150, 175, 200];
const DEFAULT_ZOOM = 100;
const ZOOM_ITEMS = Object.fromEntries(ZOOM_LEVELS.map((z) => [String(z), `${z}%`]));

function isImageFile(file: File) {
  return file.type.startsWith("image/");
}

export function RichNoteEditor({
  content,
  onChange,
  menteeId,
}: {
  content: string;
  onChange: (html: string) => void;
  menteeId: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);

  async function insertImageFile(file: File, view: EditorView, pos: number) {
    const formData = new FormData();
    formData.set("file", file);
    try {
      const url = await uploadNoteImage(menteeId, formData);
      const node = view.state.schema.nodes.image?.create({ src: url });
      if (!node) return;
      view.dispatch(view.state.tr.insert(pos, node));
    } catch {
      window.alert("Não foi possível enviar a imagem. Tente novamente.");
    }
  }

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ link: false }),
      TiptapLink.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: "noreferrer", target: "_blank" },
      }),
      ResizableImage,
      TextStyle,
      FontSize,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: "Escreva suas anotações aqui..." }),
    ],
    content,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: { class: "min-h-[300px] px-6 py-5" },
      handleDrop: (view, event, _slice, moved) => {
        if (moved) return false;
        const files = Array.from(event.dataTransfer?.files ?? []).filter(isImageFile);
        if (files.length === 0) return false;

        event.preventDefault();
        const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
        const pos = coords?.pos ?? view.state.selection.from;
        files.forEach((file) => void insertImageFile(file, view, pos));
        return true;
      },
      handlePaste: (view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []).filter(isImageFile);
        if (files.length === 0) return false;

        event.preventDefault();
        const pos = view.state.selection.from;
        files.forEach((file) => void insertImageFile(file, view, pos));
        return true;
      },
    },
  });

  // Sincroniza o conteúdo quando a nota selecionada muda por fora (troca de
  // nota na lista) — sem isso o editor continuaria mostrando o texto antigo.
  // O `setContent` dispara re-render síncrono dos NodeViews (imagem
  // redimensionável), que usa flushSync internamente — chamá-lo direto
  // dentro do efeito colide com o commit em andamento do React, então
  // adiamos pra depois desse commit terminar.
  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() === content) return;
    queueMicrotask(() => {
      if (!editor.isDestroyed) {
        editor.commands.setContent(content, { emitUpdate: false });
      }
    });
  }, [content, editor]);

  const currentFontSize = useEditorState({
    editor,
    selector: ({ editor }) => {
      const fontSize = editor?.getAttributes("textStyle").fontSize as string | undefined;
      return fontSize ? Number.parseInt(fontSize, 10) : DEFAULT_FONT_SIZE;
    },
  });

  if (!editor) return null;

  function setLink() {
    const previousUrl = editor?.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL do link", previousUrl ?? "https://");
    if (url === null) return;
    if (url.trim() === "") {
      editor?.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor?.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  }

  function applyFontSize(size: number) {
    const clamped = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, size));
    editor?.chain().focus().setFontSize(`${clamped}px`).run();
  }

  async function handleImagePick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !editor) return;

    const formData = new FormData();
    formData.set("file", file);
    try {
      const url = await uploadNoteImage(menteeId, formData);
      editor.chain().focus().setImage({ src: url }).run();
    } catch {
      window.alert("Não foi possível enviar a imagem. Tente novamente.");
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex flex-wrap items-center gap-1 border-b border-border px-3 py-2">
        <div className="flex items-center gap-0.5 rounded-lg border border-border">
          <button
            type="button"
            onClick={() => applyFontSize((currentFontSize ?? DEFAULT_FONT_SIZE) - 1)}
            className="flex size-8 items-center justify-center rounded-l-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Minus className="size-3.5" />
          </button>
          <input
            type="number"
            value={currentFontSize ?? DEFAULT_FONT_SIZE}
            onChange={(e) => applyFontSize(Number.parseInt(e.target.value, 10) || DEFAULT_FONT_SIZE)}
            className="w-10 border-x border-border bg-transparent py-1.5 text-center text-sm outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <button
            type="button"
            onClick={() => applyFontSize((currentFontSize ?? DEFAULT_FONT_SIZE) + 1)}
            className="flex size-8 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Plus className="size-3.5" />
          </button>
        </div>

        <div className="mx-1 h-4 w-px bg-border" />

        <ToolbarButton active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold className="size-4" />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("taskList")}
          onClick={() => editor.chain().focus().toggleTaskList().run()}
        >
          <ListTodo className="size-4" />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive("link")} onClick={setLink}>
          <LinkIcon className="size-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => fileInputRef.current?.click()}>
          <ImageIcon className="size-4" />
        </ToolbarButton>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImagePick}
        />
        <div className="mx-1 h-4 w-px bg-border" />
        <ToolbarButton onClick={() => editor.chain().focus().undo().run()}>
          <Undo2 className="size-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()}>
          <Redo2 className="size-4" />
        </ToolbarButton>

        <div className="ml-auto flex items-center gap-1.5">
          <ZoomIn className="size-4 text-muted-foreground" />
          <Select
            value={String(zoom)}
            onValueChange={(value) => value && setZoom(Number.parseInt(value, 10))}
            items={ZOOM_ITEMS}
          >
            <SelectTrigger className="h-8 w-[84px] text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ZOOM_LEVELS.map((level) => (
                <SelectItem key={level} value={String(level)}>
                  {level}%
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <EditorContent editor={editor} className="text-sm" style={{ zoom: `${zoom}%` }} />
      </div>
    </div>
  );
}

function ToolbarButton({
  children,
  active,
  onClick,
}: {
  children: ReactNode;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
        active && "bg-accent text-foreground",
      )}
    >
      {children}
    </button>
  );
}

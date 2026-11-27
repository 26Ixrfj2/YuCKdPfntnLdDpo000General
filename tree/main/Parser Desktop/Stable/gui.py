# === ЧАСТЬ 1: СИСТЕМНОЕ ОКНО, СТИЛЬ ПОЛЕЙ БЕЗ БЕЛЫХ РАМОК, ГОД И ПЕРИОД ===
import json
import os
import re
import shutil
import subprocess
import sys
import threading
from datetime import datetime
import tkinter as tk
from tkinter import messagebox, scrolledtext, ttk
from PIL import Image, ImageTk

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ELEMENT_DIR = os.path.join(BASE_DIR, "Element")
ARCH_DIR = os.path.join(BASE_DIR, "arch")
STATE_FILE = os.path.join(ARCH_DIR, "rotation_state.json")

LOGO_ICO = os.path.join(ELEMENT_DIR, "logo.ico")
RED_ICO = os.path.join(ELEMENT_DIR, "red.ico")
VERS_ICO = os.path.join(ELEMENT_DIR, "vers.ico")

MIN_YEAR = 1958
MAX_YEAR = 2030
ALL_YEARS = [str(y) for y in range(MAX_YEAR, MIN_YEAR - 1, -1)]

PROCESS_ITEMS = [
    ("СБОР БАЗЫ", "run.py"),
    ("ПАРСИНГ", "scrape_tmdb.py"),
    ("СВЕРКА", "verify_anilist.py"),
    ("ДОГРУЗКА", "control.py"),
    ("ВЫГРУЗКА", "upload.py"),
]


class AnimeParserGUI:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("Anime Parser")
        self.root.geometry("1120x720")
        self.root.minsize(920, 580)
        self.root.configure(bg="#1e1e2e")

        if os.path.exists(LOGO_ICO):
            try:
                self.root.iconbitmap(LOGO_ICO)
            except Exception:
                pass

        self.current_process = None
        self.is_running = False
        self.stop_requested = False

        self.editing_script = None
        self.original_code = ""
        self.version_popup = None

        init_year = self._read_current_year()
        self.saved_date_mode = ("single", init_year, "", "")
        self.has_saved_date = os.path.exists(os.path.join(BASE_DIR, "run.py"))

        self.img_red = self._load_icon_image(RED_ICO, (18, 18), make_white=True)
        self.img_vers = self._load_icon_image(VERS_ICO, (18, 18), make_white=True)

        self._setup_combobox_style()
        self._build_ui()

    def _setup_combobox_style(self):
        style = ttk.Style()
        style.theme_use("clam")
        style.configure(
            "Dark.TCombobox",
            fieldbackground="#313244",
            background="#313244",
            foreground="#f5e0dc",
            arrowcolor="#cdd6f4",
            bordercolor="#313244",
            lightcolor="#313244",
            darkcolor="#313244",
            focusfill="#313244",
            borderwidth=0,
            relief="flat",
            padding=5
        )
        style.map(
            "Dark.TCombobox",
            fieldbackground=[("readonly", "#313244"), ("focus", "#313244")],
            foreground=[("readonly", "#f5e0dc"), ("focus", "#f5e0dc")],
            background=[("readonly", "#313244"), ("active", "#45475a")],
            bordercolor=[("readonly", "#313244"), ("focus", "#313244")],
            lightcolor=[("readonly", "#313244"), ("focus", "#313244")],
            darkcolor=[("readonly", "#313244"), ("focus", "#313244")]
        )

    def _load_icon_image(self, path: str, size: tuple[int, int], make_white: bool = False):
        if not os.path.exists(path):
            return None
        try:
            im = Image.open(path).convert("RGBA")
            im = im.resize(size, Image.Resampling.LANCZOS)
            if make_white:
                r, g, b, a = im.split()
                white_rgb = Image.new("RGB", size, (255, 255, 255))
                im = Image.merge("RGBA", (*white_rgb.split(), a))
            return ImageTk.PhotoImage(im)
        except Exception:
            return None

    def _build_ui(self):
        body = tk.Frame(self.root, bg="#1e1e2e")
        body.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

        left_panel = tk.Frame(body, bg="#1e1e2e", width=335, padx=8, pady=6)
        left_panel.pack(side=tk.LEFT, fill=tk.Y, padx=(0, 10))
        left_panel.pack_propagate(False)

        # Блок выбора ГОДА
        year_row = tk.Frame(left_panel, bg="#1e1e2e")
        year_row.pack(fill=tk.X, pady=(0, 6))

        tk.Label(
            year_row, text="ГОД:", fg="#cdd6f4", bg="#1e1e2e",
            font=("Segoe UI", 9, "bold"), width=8, anchor="w"
        ).pack(side=tk.LEFT)

        self.year_var = tk.StringVar(value=self.saved_date_mode[1])
        self.combo_year = ttk.Combobox(
            year_row, textvariable=self.year_var, values=ALL_YEARS,
            state="readonly", style="Dark.TCombobox", font=("Segoe UI", 10, "bold")
        )
        self.combo_year.pack(side=tk.LEFT, fill=tk.X, expand=True)
        self.combo_year.bind("<<ComboboxSelected>>", self._on_single_year_selected)

        # Блок выбора ПЕРИОДА ("от" и "по")
        period_row = tk.Frame(left_panel, bg="#1e1e2e")
        period_row.pack(fill=tk.X, pady=(0, 6))

        tk.Label(
            period_row, text="ПЕРИОД:", fg="#cdd6f4", bg="#1e1e2e",
            font=("Segoe UI", 9, "bold"), width=8, anchor="w"
        ).pack(side=tk.LEFT)

        self.from_var = tk.StringVar(value="")
        self.combo_from = ttk.Combobox(
            period_row, textvariable=self.from_var, values=ALL_YEARS,
            state="readonly", style="Dark.TCombobox", width=8, font=("Segoe UI", 10, "bold")
        )
        self.combo_from.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 6))
        self.combo_from.bind("<<ComboboxSelected>>", self._on_from_year_selected)

        self.to_var = tk.StringVar(value="")
        self.combo_to = ttk.Combobox(
            period_row, textvariable=self.to_var, values=ALL_YEARS,
            state="readonly", style="Dark.TCombobox", width=8, font=("Segoe UI", 10, "bold")
        )
        self.combo_to.pack(side=tk.LEFT, fill=tk.X, expand=True)
        self.combo_to.bind("<<ComboboxSelected>>", self._on_to_year_selected)

        # Зарезервированный отступ под кнопки СОХРАНИТЬ и крестик сброса ✕
        self.date_actions_slot = tk.Frame(left_panel, bg="#1e1e2e", height=36)
        self.date_actions_slot.pack(fill=tk.X, pady=(2, 10))
        self.date_actions_slot.pack_propagate(False)

        self.btn_date_save = tk.Button(
            self.date_actions_slot, text="СОХРАНИТЬ", command=self._save_date_selection,
            bg="#313244", fg="#a6e3a1", activebackground="#45475a", activeforeground="#a6e3a1",
            font=("Segoe UI", 9, "bold"), relief=tk.FLAT, pady=4, cursor="hand2"
        )
        self.btn_date_reset = tk.Button(
            self.date_actions_slot, text="✕", command=self._reset_date_selection,
            bg="#313244", fg="#f38ba8", activebackground="#45475a", activeforeground="#f38ba8",
            font=("Segoe UI", 9, "bold"), relief=tk.FLAT, width=3, pady=4, cursor="hand2"
        )
# === ЧАСТЬ 2A: ЛЕВАЯ ПАНЕЛЬ СЕРЫХ КНОПОК ===
        state_row = tk.Frame(left_panel, bg="#1e1e2e")
        state_row.pack(fill=tk.X, pady=4)

        self.btn_states = tk.Button(
            state_row, text="СОСТОЯНИЯ", command=self.on_states_click,
            bg="#313244", fg="#cdd6f4", activebackground="#45475a", activeforeground="white",
            font=("Segoe UI", 10, "bold"), relief=tk.FLAT, pady=8, cursor="hand2"
        )
        self.btn_states.pack(side=tk.LEFT, fill=tk.X, expand=True)

        tk.Button(
            state_row,
            image=self.img_red if self.img_red else None,
            text="" if self.img_red else "✎",
            bg="#262636", fg="#6c7086", state=tk.DISABLED,
            relief=tk.FLAT, width=34 if self.img_red else 3
        ).pack(side=tk.LEFT, padx=(5, 0), fill=tk.Y)

        tk.Button(
            state_row,
            image=self.img_vers if self.img_vers else None,
            text="" if self.img_vers else "◷",
            bg="#262636", fg="#6c7086", state=tk.DISABLED,
            relief=tk.FLAT, width=34 if self.img_vers else 3
        ).pack(side=tk.LEFT, padx=(5, 0), fill=tk.Y)

        self.action_buttons = []
        for label, script_name in PROCESS_ITEMS:
            row = tk.Frame(left_panel, bg="#1e1e2e")
            row.pack(fill=tk.X, pady=4)

            btn_run = tk.Button(
                row, text=label, command=lambda s=script_name: self.run_single_step(s),
                bg="#313244", fg="#cdd6f4", activebackground="#45475a", activeforeground="white",
                font=("Segoe UI", 10, "bold"), relief=tk.FLAT, pady=8, cursor="hand2"
            )
            btn_run.pack(side=tk.LEFT, fill=tk.X, expand=True)
            self.action_buttons.append(btn_run)

            btn_edit = tk.Button(
                row,
                image=self.img_red if self.img_red else None,
                text="" if self.img_red else "✎",
                command=lambda s=script_name: self.open_script_editor(s),
                bg="#313244", fg="white", activebackground="#45475a", activeforeground="white",
                relief=tk.FLAT, width=34 if self.img_red else 3, cursor="hand2"
            )
            btn_edit.pack(side=tk.LEFT, padx=(5, 0), fill=tk.Y)

            btn_ver = tk.Button(
                row,
                image=self.img_vers if self.img_vers else None,
                text="" if self.img_vers else "◷",
                command=lambda s=script_name, b=btn_run: self.open_versions_dialog(s, b),
                bg="#313244", fg="white", activebackground="#45475a", activeforeground="white",
                relief=tk.FLAT, width=34 if self.img_vers else 3, cursor="hand2"
            )
            btn_ver.pack(side=tk.LEFT, padx=(5, 0), fill=tk.Y)

        tk.Frame(left_panel, bg="#313244", height=1).pack(fill=tk.X, pady=12)

        tk.Button(
            left_panel, text="ФАЙЛЫ",
            command=lambda: self.open_folder(BASE_DIR),
            bg="#313244", fg="#cdd6f4", activebackground="#45475a", activeforeground="white",
            font=("Segoe UI", 10, "bold"), relief=tk.FLAT, pady=8, cursor="hand2"
        ).pack(fill=tk.X, pady=4)

        tk.Button(
            left_panel, text="ДАТАСЕТ",
            command=lambda: self.open_folder(os.path.join(BASE_DIR, "anime_data")),
            bg="#313244", fg="#cdd6f4", activebackground="#45475a", activeforeground="white",
            font=("Segoe UI", 10, "bold"), relief=tk.FLAT, pady=8, cursor="hand2"
        ).pack(fill=tk.X, pady=4)
# === ЧАСТЬ 2Б: ПРАВОЕ ОКНО, НИЖНЯЯ ПАНЕЛЬ И УМНЫЙ ВЫБОР ГОДА / ПЕРИОДА ===
        right_panel = tk.Frame(body, bg="#11111b")
        right_panel.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True)

        right_top = tk.Frame(right_panel, bg="#181825", padx=12, pady=7)
        right_top.pack(fill=tk.X)

        self.editor_title_var = tk.StringVar(value="Консоль выполнения")
        tk.Label(
            right_top, textvariable=self.editor_title_var, fg="#cdd6f4", bg="#181825",
            font=("Segoe UI", 9, "bold")
        ).pack(side=tk.LEFT)

        self.btn_back_to_log = tk.Button(
            right_top, text="← В консоль", command=self.switch_to_console_mode,
            bg="#313244", fg="#cdd6f4", activebackground="#45475a", activeforeground="white",
            font=("Segoe UI", 8, "bold"), relief=tk.FLAT, padx=10, pady=2, cursor="hand2"
        )

        tk.Button(
            right_top, text="Очистить", command=self.clear_text_box,
            bg="#313244", fg="#cdd6f4", activebackground="#45475a", activeforeground="white",
            font=("Segoe UI", 8), relief=tk.FLAT, padx=10, pady=2, cursor="hand2"
        ).pack(side=tk.RIGHT)

        self.text_box = scrolledtext.ScrolledText(
            right_panel, wrap=tk.NONE, bg="#11111b", fg="#a6e3a1",
            insertbackground="white", font=("Consolas", 10), relief=tk.FLAT, padx=12, pady=10, undo=True
        )
        self.text_box.pack(fill=tk.BOTH, expand=True)
        self.text_box.bind("<<Modified>>", self._on_text_modified)

        right_bottom = tk.Frame(right_panel, bg="#181825", height=40, padx=12)
        right_bottom.pack(fill=tk.X, side=tk.BOTTOM)
        right_bottom.pack_propagate(False)

        self.status_var = tk.StringVar(value="Готов к работе.")
        tk.Label(
            right_bottom, textvariable=self.status_var, fg="#a6adc8", bg="#181825",
            font=("Segoe UI", 9)
        ).pack(side=tk.LEFT, pady=8)

        self.btn_stop = tk.Button(
            right_bottom, text="■ СТОП", command=self.stop_current,
            bg="#313244", fg="#f38ba8", activebackground="#45475a", activeforeground="#f38ba8",
            font=("Segoe UI", 9, "bold"), relief=tk.FLAT, padx=14, pady=4, cursor="hand2"
        )

        self.btn_save_code = tk.Button(
            right_bottom, text="СОХРАНИТЬ", command=self.save_edited_script,
            bg="#313244", fg="#a6e3a1", activebackground="#45475a", activeforeground="#a6e3a1",
            font=("Segoe UI", 9, "bold"), relief=tk.FLAT, padx=14, pady=4, cursor="hand2"
        )

        self.btn_cancel_code = tk.Button(
            right_bottom, text="✕", command=self.cancel_code_changes,
            bg="#313244", fg="#f38ba8", activebackground="#45475a", activeforeground="#f38ba8",
            font=("Segoe UI", 9, "bold"), relief=tk.FLAT, width=3, pady=4, cursor="hand2"
        )

    def _show_date_action_buttons(self):
        if not self.btn_date_reset.winfo_ismapped():
            self.btn_date_reset.pack(side=tk.RIGHT, padx=(5, 0), fill=tk.Y)
        if not self.btn_date_save.winfo_ismapped():
            self.btn_date_save.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

    def _hide_date_action_buttons(self):
        self.btn_date_save.pack_forget()
        self.btn_date_reset.pack_forget()

    def _on_single_year_selected(self, event=None):
        self.from_var.set("")
        self.to_var.set("")
        self.combo_from.config(values=ALL_YEARS)
        self.combo_to.config(values=ALL_YEARS)
        self._show_date_action_buttons()

    def _on_from_year_selected(self, event=None):
        f_val = self.from_var.get()
        if f_val.isdigit():
            f_int = int(f_val)
            allowed_to = [str(y) for y in range(MAX_YEAR, f_int - 1, -1)]
            self.combo_to.config(values=allowed_to)
            if self.to_var.get().isdigit() and int(self.to_var.get()) < f_int:
                self.to_var.set("")

        if self.from_var.get() and self.to_var.get():
            self.year_var.set("")
            self._show_date_action_buttons()

    def _on_to_year_selected(self, event=None):
        t_val = self.to_var.get()
        if t_val.isdigit():
            t_int = int(t_val)
            allowed_from = [str(y) for y in range(t_int, MIN_YEAR - 1, -1)]
            self.combo_from.config(values=allowed_from)
            if self.from_var.get().isdigit() and int(self.from_var.get()) > t_int:
                self.from_var.set("")

        if self.from_var.get() and self.to_var.get():
            self.year_var.set("")
            self._show_date_action_buttons()

    def _save_date_selection(self):
        y_single = self.year_var.get().strip()
        y_from = self.from_var.get().strip()
        y_to = self.to_var.get().strip()

        if y_single:
            self.saved_date_mode = ("single", y_single, "", "")
            self.has_saved_date = True
            self._apply_year_to_run_py(int(y_single))
            self.status_var.set(f"Сохранён год: {y_single}")
        elif y_from and y_to:
            self.saved_date_mode = ("period", "", y_from, y_to)
            self.has_saved_date = True
            self._apply_year_to_run_py(int(y_from))
            self.status_var.set(f"Сохранён период: с {y_from} по {y_to}")

        self._hide_date_action_buttons()

    def _reset_date_selection(self):
        self.combo_from.config(values=ALL_YEARS)
        self.combo_to.config(values=ALL_YEARS)

        if self.has_saved_date:
            mode, y_single, y_from, y_to = self.saved_date_mode
            self.year_var.set(y_single)
            self.from_var.set(y_from)
            self.to_var.set(y_to)
        else:
            self.year_var.set("2026")
            self.from_var.set("")
            self.to_var.set("")

        self._hide_date_action_buttons()
        self.status_var.set("Выбор года/периода сброшен.")

# === ЧАСТЬ 3A: ОТКРЫТИЕ ПАПОК И ВСТРОЕННЫЙ РЕДАКТОР КОДА ===
    def on_states_click(self):
        self.switch_to_console_mode()
        self.append_log("[СОСТОЯНИЯ] Кнопка подготовлена — логика будет назначена следующим шагом.\n")

    def open_folder(self, folder_path: str):
        """Открывает строго папку в Проводнике Windows."""
        norm_path = os.path.normpath(folder_path)
        os.makedirs(norm_path, exist_ok=True)
        try:
            if os.name == "nt":
                subprocess.Popen(["explorer", norm_path])
            else:
                subprocess.Popen(["xdg-open", norm_path])
        except Exception as e:
            messagebox.showerror("Ошибка", f"Не удалось открыть папку:\n{e}")

    def switch_to_console_mode(self):
        self.editing_script = None
        self.original_code = ""
        self.editor_title_var.set("Консоль выполнения")
        self.btn_back_to_log.pack_forget()
        self.btn_save_code.pack_forget()
        self.btn_cancel_code.pack_forget()
        self.text_box.config(fg="#a6e3a1", wrap=tk.WORD)
        self.text_box.delete("1.0", tk.END)
        self.text_box.edit_modified(False)

    def open_script_editor(self, script_name: str):
        if self.is_running:
            messagebox.showwarning("Процесс запущен", "Дождитесь завершения или остановите текущий процесс.")
            return

        script_path = os.path.join(BASE_DIR, script_name)
        if not os.path.exists(script_path):
            messagebox.showerror("Файл не найден", f"Файл '{script_name}' отсутствует в папке проекта.")
            return

        with open(script_path, "r", encoding="utf-8") as f:
            code = f.read()

        self.editing_script = script_name
        self.original_code = code
        self.editor_title_var.set(f"Редактирование файла: {script_name}")
        self.btn_back_to_log.pack(side=tk.RIGHT, padx=(0, 6))
        self.btn_save_code.pack_forget()
        self.btn_cancel_code.pack_forget()

        self.text_box.config(fg="#cdd6f4", wrap=tk.NONE)
        self.text_box.delete("1.0", tk.END)
        self.text_box.insert("1.0", code)
        self.text_box.edit_modified(False)
        self.status_var.set(f"Открыт файл: {script_name}")

    def _on_text_modified(self, event=None):
        if not self.editing_script:
            self.text_box.edit_modified(False)
            return

        current_text = self.text_box.get("1.0", "end-1c")
        if current_text != self.original_code:
            if not self.btn_save_code.winfo_ismapped():
                self.btn_save_code.pack(side=tk.RIGHT)
            if not self.btn_cancel_code.winfo_ismapped():
                self.btn_cancel_code.pack(side=tk.RIGHT, padx=(0, 6))
        else:
            self.btn_save_code.pack_forget()
            self.btn_cancel_code.pack_forget()
        self.text_box.edit_modified(False)

    def cancel_code_changes(self):
        if not self.editing_script:
            return
        self.text_box.delete("1.0", tk.END)
        self.text_box.insert("1.0", self.original_code)
        self.text_box.edit_modified(False)
        self.btn_save_code.pack_forget()
        self.btn_cancel_code.pack_forget()
        self.status_var.set(f"Несохранённые изменения в '{self.editing_script}' отменены.")

    def save_edited_script(self):
        if not self.editing_script:
            return
        script_path = os.path.join(BASE_DIR, self.editing_script)
        new_code = self.text_box.get("1.0", "end-1c")
        try:
            with open(script_path, "w", encoding="utf-8") as f:
                f.write(new_code)
            self.original_code = new_code
            self.btn_save_code.pack_forget()
            self.btn_cancel_code.pack_forget()
            self.status_var.set(f"Файл '{self.editing_script}' успешно сохранён.")
        except Exception as e:
            messagebox.showerror("Ошибка сохранения", str(e))
# === ЧАСТЬ 3Б: РОТАЦИЯ 3 ВЕРСИЙ И ОКНО НАЗНАЧЕНИЯ ВЕРСИИ ===
    def _get_next_version_slot(self, script_name: str) -> int:
        os.makedirs(ARCH_DIR, exist_ok=True)
        state = {}
        if os.path.exists(STATE_FILE):
            try:
                with open(STATE_FILE, "r", encoding="utf-8") as f:
                    state = json.load(f)
            except Exception:
                state = {}

        last_slot = int(state.get(script_name, 0))
        next_slot = (last_slot % 3) + 1
        state[script_name] = next_slot
        with open(STATE_FILE, "w", encoding="utf-8") as f:
            json.dump(state, f, ensure_ascii=False, indent=2)
        return next_slot

    def _find_saved_versions(self, script_name: str) -> list[dict]:
        versions = []
        for slot in (1, 2, 3):
            v_dir = os.path.join(ARCH_DIR, f"Version {slot}")
            v_file = os.path.join(v_dir, script_name)
            if os.path.exists(v_file):
                mtime = os.path.getmtime(v_file)
                dt_str = datetime.fromtimestamp(mtime).strftime("%d.%m.%Y %H:%M:%S")
                versions.append({
                    "slot": slot,
                    "label": f"Version {slot} — {dt_str}",
                    "path": v_file,
                    "mtime": mtime
                })
        versions.sort(key=lambda x: x["mtime"], reverse=True)
        return versions

    def open_versions_dialog(self, script_name: str, anchor_widget: tk.Widget):
        if self.version_popup and self.version_popup.winfo_exists():
            self.version_popup.destroy()

        popup = tk.Toplevel(self.root)
        popup.title(f"Версии: {script_name}")
        popup.configure(bg="#181825")
        popup.resizable(False, False)
        popup.transient(self.root)
        popup.grab_set()
        self.version_popup = popup

        x = anchor_widget.winfo_rootx() + 45
        y = anchor_widget.winfo_rooty()
        popup.geometry(f"330x140+{x}+{y}")

        container = tk.Frame(popup, bg="#181825", padx=14, pady=12)
        container.pack(fill=tk.BOTH, expand=True)

        tk.Label(
            container, text=f"Резервные копии: {script_name}", fg="#cdd6f4", bg="#181825",
            font=("Segoe UI", 10, "bold")
        ).pack(anchor="w", pady=(0, 10))

        def do_save_version():
            src_file = os.path.join(BASE_DIR, script_name)
            if not os.path.exists(src_file):
                messagebox.showerror("Ошибка", f"Файл '{script_name}' не найден.", parent=popup)
                return
            slot = self._get_next_version_slot(script_name)
            dst_dir = os.path.join(ARCH_DIR, f"Version {slot}")
            os.makedirs(dst_dir, exist_ok=True)
            shutil.copy2(src_file, os.path.join(dst_dir, script_name))
            self.status_var.set(f"Сохранено в arch\\Version {slot}\\{script_name}")
            popup.destroy()

        tk.Button(
            container, text="СОХРАНИТЬ ВЕРСИЮ", command=do_save_version,
            bg="#313244", fg="#cdd6f4", activebackground="#45475a", activeforeground="white",
            font=("Segoe UI", 9, "bold"), relief=tk.FLAT, pady=6, cursor="hand2"
        ).pack(fill=tk.X, pady=(0, 6))

        saved_list = self._find_saved_versions(script_name)
        if saved_list:
            def expand_versions_list():
                btn_assign.pack_forget()
                new_height = 140 + len(saved_list) * 36
                popup.geometry(f"330x{new_height}+{x}+{y}")

                tk.Label(
                    container, text="Выберите версию для загрузки в окно:",
                    fg="#a6adc8", bg="#181825", font=("Segoe UI", 8)
                ).pack(anchor="w", pady=(4, 4))

                for ver in saved_list:
                    tk.Button(
                        container, text=ver["label"],
                        command=lambda p=ver["path"], lbl=ver["label"]: self._apply_version_to_editor(script_name, p, lbl, popup),
                        bg="#313244", fg="#f5e0dc", activebackground="#45475a", activeforeground="white",
                        font=("Segoe UI", 9), relief=tk.FLAT, pady=5, cursor="hand2"
                    ).pack(fill=tk.X, pady=2)

            btn_assign = tk.Button(
                container, text="НАЗНАЧИТЬ ВЕРСИЮ", command=expand_versions_list,
                bg="#313244", fg="#a6e3a1", activebackground="#45475a", activeforeground="#a6e3a1",
                font=("Segoe UI", 9, "bold"), relief=tk.FLAT, pady=6, cursor="hand2"
            )
            btn_assign.pack(fill=tk.X)

    def _apply_version_to_editor(self, script_name: str, version_file_path: str, label: str, popup: tk.Toplevel):
        try:
            with open(version_file_path, "r", encoding="utf-8") as f:
                ver_code = f.read()

            self.open_script_editor(script_name)
            self.text_box.delete("1.0", tk.END)
            self.text_box.insert("1.0", ver_code)
            self.text_box.edit_modified(True)
            self._on_text_modified()
            self.status_var.set(f"Загружена {label}. Нажмите СОХРАНИТЬ для применения.")
            popup.destroy()
        except Exception as e:
            messagebox.showerror("Ошибка загрузки версии", str(e), parent=popup)
# === ЧАСТЬ 3В: ФОНОВЫЙ ЗАПУСК СКРИПТОВ И ОСТАНОВКА ===
    def _read_current_year(self) -> str:
        run_path = os.path.join(BASE_DIR, "run.py")
        if os.path.exists(run_path):
            try:
                with open(run_path, "r", encoding="utf-8") as f:
                    content = f.read()
                m = re.search(r"^TARGET_YEAR\s*=\s*(\d{4})", content, re.MULTILINE)
                if m:
                    return m.group(1)
            except Exception:
                pass
        return "2026"

    def _apply_year_to_run_py(self, year_int: int):
        run_path = os.path.join(BASE_DIR, "run.py")
        if not os.path.exists(run_path):
            return
        try:
            with open(run_path, "r", encoding="utf-8") as f:
                content = f.read()
            new_content, count = re.subn(
                r"^TARGET_YEAR\s*=\s*\d{4}",
                f"TARGET_YEAR = {year_int}",
                content,
                count=1,
                flags=re.MULTILINE
            )
            if count > 0 and new_content != content:
                with open(run_path, "w", encoding="utf-8") as f:
                    f.write(new_content)
        except Exception as e:
            self.append_log(f"[GUI] Не удалось обновить год в run.py: {e}\n")

    def append_log(self, text: str):
        def _insert():
            self.text_box.insert(tk.END, text)
            self.text_box.see(tk.END)
        self.root.after(0, _insert)

    def clear_text_box(self):
        self.text_box.delete("1.0", tk.END)
        if self.editing_script:
            self._on_text_modified()

    def _set_controls_state(self, running: bool):
        def _update():
            self.is_running = running
            state_main = tk.DISABLED if running else tk.NORMAL
            for b in self.action_buttons:
                b.config(state=state_main)
            if running:
                self.btn_save_code.pack_forget()
                self.btn_cancel_code.pack_forget()
                if not self.btn_stop.winfo_ismapped():
                    self.btn_stop.pack(side=tk.RIGHT)
            else:
                self.btn_stop.pack_forget()
        self.root.after(0, _update)

    def run_single_step(self, script_name: str):
        if self.is_running:
            return
        if self.editing_script:
            self.switch_to_console_mode()

        mode, y_single, y_from, y_to = self.saved_date_mode
        if script_name == "run.py" and mode == "period" and y_from and y_to:
            years_list = list(range(int(y_from), int(y_to) + 1))
        elif script_name == "run.py" and y_single:
            years_list = [int(y_single)]
        else:
            years_list = [None]

        self.stop_requested = False
        threading.Thread(target=self._execute_script_for_years, args=(script_name, years_list), daemon=True).start()

    def _execute_script_for_years(self, script_name: str, years_list: list):
        self._set_controls_state(True)
        env = os.environ.copy()
        env["PYTHONUNBUFFERED"] = "1"
        env["PYTHONIOENCODING"] = "utf-8"

        script_path = os.path.join(BASE_DIR, script_name)
        if not os.path.exists(script_path):
            self.append_log(f"\n[!] Файл '{script_name}' не найден в папке проекта.\n")
            self._set_controls_state(False)
            return

        for yr in years_list:
            if self.stop_requested:
                break

            if yr is not None:
                self._apply_year_to_run_py(yr)
                self.append_log(f"\n[GUI] Установлен год: {yr}\n")

            self.root.after(0, lambda s=script_name: self.status_var.set(f"Выполняется: {s}..."))
            self.append_log(f"\n{'=' * 65}\n▶ ЗАПУСК: {script_name}\n{'=' * 65}\n")

            try:
                creation_flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
                self.current_process = subprocess.Popen(
                    [sys.executable, "-u", script_path],
                    cwd=BASE_DIR,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    encoding="utf-8",
                    errors="replace",
                    env=env,
                    creationflags=creation_flags
                )

                for line in self.current_process.stdout:
                    self.append_log(line)

                ret_code = self.current_process.wait()
                self.current_process = None

                if self.stop_requested:
                    self.append_log(f"\n■ Процесс '{script_name}' остановлен пользователем.\n")
                    break
                if ret_code != 0:
                    self.append_log(f"\n[!] Скрипт '{script_name}' завершился с кодом ошибки {ret_code}.\n")
                    break

            except Exception as e:
                self.append_log(f"\n[!] Ошибка запуска '{script_name}': {e}\n")
                break

        self.current_process = None
        self._set_controls_state(False)
        self.root.after(0, lambda: self.status_var.set("Готов к работе."))

    def stop_current(self):
        self.stop_requested = True
        if self.current_process and self.current_process.poll() is None:
            try:
                self.current_process.terminate()
            except Exception:
                pass


if __name__ == "__main__":
    app_root = tk.Tk()
    AnimeParserGUI(app_root)
    app_root.mainloop()


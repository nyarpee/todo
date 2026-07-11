"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Save, Trash2 } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { DEFAULT_HABIT_COLOR, HABIT_COLORS } from "@/lib/habit-colors";
import type { Habit, HabitColor, HabitUnitType } from "@/types/habit";
import { DraggableBottomSheet } from "./DraggableBottomSheet";

type HabitEditorSheetProps =
  | {
      mode: "create";
      onDismiss: () => void;
      onSave: (title: string, unitType: HabitUnitType, unitMinutes: number, color: HabitColor) => void;
    }
  | {
      mode: "edit";
      habit: Habit;
      entryCount: number;
      onDismiss: () => void;
      onSave: (title: string, unitType: HabitUnitType, unitMinutes: number, color: HabitColor) => void;
      onDelete: () => void;
    };

export function HabitEditorSheet(props: HabitEditorSheetProps) {
  const { messages: text } = useLanguage();
  const [title, setTitle] = useState(props.mode === "edit" ? props.habit.title : "");
  const [unitMinutes, setUnitMinutes] = useState(
    props.mode === "edit" ? String(props.habit.unitMinutes) : "15",
  );
  const [unitType, setUnitType] = useState<HabitUnitType>(
    props.mode === "edit" ? props.habit.unitType : "minutes",
  );
  const [color, setColor] = useState<HabitColor>(
    props.mode === "edit" ? props.habit.color : DEFAULT_HABIT_COLOR,
  );
  const titleInputRef = useRef<HTMLInputElement>(null);
  const parsedUnit = Number(unitMinutes);
  const canSave =
    title.trim().length > 0 &&
    (unitType === "times" || (Number.isFinite(parsedUnit) && parsedUnit > 0));

  useEffect(() => {
    const focusTimer = window.setTimeout(() => {
      titleInputRef.current?.focus({ preventScroll: true });
    }, 80);
    return () => window.clearTimeout(focusTimer);
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave) return;
    props.onSave(title.trim(), unitType, unitType === "times" ? 0 : Math.round(parsedUnit), color);
  }

  function handleDelete() {
    if (props.mode !== "edit") return;

    const message =
      props.entryCount > 0
        ? text.habitEditor.deleteWithChecks.replace("{count}", String(props.entryCount))
        : text.habitEditor.deleteOne;

    if (window.confirm(message)) {
      props.onDelete();
    }
  }

  return (
    <DraggableBottomSheet
      ariaLabel={props.mode === "create" ? text.habitEditor.addHabit : text.habitEditor.habitMenu}
      className="habitEditorSheet"
      dismissOnBackdrop
      showHandle={false}
      onDismiss={props.onDismiss}
    >
      <form className="habitEditorForm" onSubmit={handleSubmit}>
        <label className="habitEditorRow habitTitleRow">
          <span>{text.habitEditor.title}</span>
          <input
            ref={titleInputRef}
            className="habitTitleEditorInput"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={text.habitEditor.title}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
        </label>

        <div className="habitEditorRow">
          <span>{text.habitEditor.oneCheck}</span>
          <div className="habitUnitControl">
            {unitType === "minutes" ? (
              <label className="habitUnitValue">
                <input
                  inputMode="numeric"
                  min={1}
                  type="number"
                  value={unitMinutes}
                  onChange={(event) => setUnitMinutes(event.target.value)}
                />
                <strong>{text.habitEditor.min}</strong>
              </label>
            ) : (
              <div className="habitUnitValue isReadOnly">
                <span>1</span>
                <strong>{text.habitEditor.time}</strong>
              </div>
            )}
            <div className="habitUnitSegment" aria-label={text.habitEditor.unit}>
              <button
                className={unitType === "minutes" ? "isSelected" : ""}
                type="button"
                onClick={() => setUnitType("minutes")}
              >
                {text.habitEditor.min}
              </button>
              <button
                className={unitType === "times" ? "isSelected" : ""}
                type="button"
                onClick={() => setUnitType("times")}
              >
                {text.habitEditor.count}
              </button>
            </div>
          </div>
        </div>

        <div className="habitEditorRow habitColorRow" data-color={color}>
          <span>{text.habitEditor.color}</span>
          <div className="habitColorGrid" aria-label={text.habitEditor.colorLabel}>
            {HABIT_COLORS.map((option) => (
              <button
                className={option.value === color ? "habitColorCheck isSelected" : "habitColorCheck"}
                data-color={option.value}
                type="button"
                key={option.value}
                onClick={() => setColor(option.value)}
                aria-label={option.label}
              />
            ))}
          </div>
        </div>

        <button className="habitEditorSaveButton" type="submit" disabled={!canSave}>
          <Save size={18} aria-hidden="true" />
          {props.mode === "create" ? text.habitEditor.addHabit : text.habitEditor.saveHabit}
        </button>
      </form>
      {props.mode === "edit" ? (
        <button className="habitDeleteButton" type="button" onClick={handleDelete}>
          <Trash2 size={18} aria-hidden="true" />
          {text.habitEditor.deleteHabit}
        </button>
      ) : null}
    </DraggableBottomSheet>
  );
}

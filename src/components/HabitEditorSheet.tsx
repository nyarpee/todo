"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Save, Trash2 } from "lucide-react";
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
    const focusTimer = window.setTimeout(() => titleInputRef.current?.focus(), 80);
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
        ? `Delete this habit and ${props.entryCount} checks?`
        : "Delete this habit?";

    if (window.confirm(message)) {
      props.onDelete();
    }
  }

  return (
    <DraggableBottomSheet
      ariaLabel={props.mode === "create" ? "Add habit" : "Habit menu"}
      className="habitEditorSheet"
      dismissOnBackdrop
      showHandle={false}
      onDismiss={props.onDismiss}
    >
      <form className="habitEditorForm" onSubmit={handleSubmit}>
        <label className="habitEditorRow habitTitleRow">
          <span>Title</span>
          <input
            ref={titleInputRef}
            className="habitTitleEditorInput"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Title"
          />
        </label>

        <div className="habitEditorRow">
          <span>1 check</span>
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
                <strong>min</strong>
              </label>
            ) : (
              <div className="habitUnitValue isReadOnly">
                <span>1</span>
                <strong>time</strong>
              </div>
            )}
            <div className="habitUnitSegment" aria-label="Habit unit">
              <button
                className={unitType === "minutes" ? "isSelected" : ""}
                type="button"
                onClick={() => setUnitType("minutes")}
              >
                min
              </button>
              <button
                className={unitType === "times" ? "isSelected" : ""}
                type="button"
                onClick={() => setUnitType("times")}
              >
                count
              </button>
            </div>
          </div>
        </div>

        <div className="habitEditorRow habitColorRow" data-color={color}>
          <span>Color</span>
          <div className="habitColorGrid" aria-label="Habit color">
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
          {props.mode === "create" ? "Add habit" : "Save habit"}
        </button>
      </form>
      {props.mode === "edit" ? (
        <button className="habitDeleteButton" type="button" onClick={handleDelete}>
          <Trash2 size={18} aria-hidden="true" />
          Delete habit
        </button>
      ) : null}
    </DraggableBottomSheet>
  );
}

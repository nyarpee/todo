"use client";

import { MoreVertical, Plus } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import type { TaskGroup, TaskGroupId } from "@/types/task";

type GroupBarProps = {
  groups: TaskGroup[];
  activeGroupId: TaskGroupId;
  onSelectGroup: (groupId: TaskGroupId) => void;
  onRegisterGroupChipsContainer?: ((element: HTMLDivElement | null) => void) | undefined;
  onRegisterGroupChip?: ((groupId: TaskGroupId, element: HTMLButtonElement | null) => void) | undefined;
  onAddGroup: () => void;
  onOpenMenu: () => void;
};

export function GroupBar({
  groups,
  activeGroupId,
  onSelectGroup,
  onRegisterGroupChipsContainer,
  onRegisterGroupChip,
  onAddGroup,
  onOpenMenu,
}: GroupBarProps) {
  const { messages: text } = useLanguage();
  const activeGroup = groups.find((group) => group.id === activeGroupId) ?? groups[0];

  return (
    <section className="groupArea" aria-label={text.lists.area}>
      <div ref={onRegisterGroupChipsContainer} className="groupChips">
        {groups.map((group) => (
          <GroupChip
            activeGroupId={activeGroupId}
            group={group}
            key={group.id}
            onRegisterGroupChip={onRegisterGroupChip}
            onSelectGroup={onSelectGroup}
          />
        ))}
        <button className="groupAddChip" type="button" onClick={onAddGroup} aria-label={text.lists.add}>
          <Plus size={16} aria-hidden="true" />
        </button>
      </div>

      {activeGroup ? (
        <div className="groupHeader">
          <h2>{activeGroup.name}</h2>
          <button className="groupMenuButton" type="button" onClick={onOpenMenu} aria-label={text.lists.menu}>
            <MoreVertical size={18} aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </section>
  );
}

type GroupChipProps = {
  group: TaskGroup;
  activeGroupId: TaskGroupId;
  onRegisterGroupChip?: ((groupId: TaskGroupId, element: HTMLButtonElement | null) => void) | undefined;
  onSelectGroup: (groupId: TaskGroupId) => void;
};

function GroupChip({ group, activeGroupId, onRegisterGroupChip, onSelectGroup }: GroupChipProps) {
  const className = [
    "groupChip",
    group.id === activeGroupId ? "isActive" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      ref={(element) => onRegisterGroupChip?.(group.id, element)}
      className={className}
      type="button"
      onClick={() => onSelectGroup(group.id)}
    >
      {group.name}
    </button>
  );
}

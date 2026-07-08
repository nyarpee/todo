import { TaskApp } from "@/components/TaskApp";
import { KeyboardInsetManager } from "@/components/KeyboardInsetManager";
import { LanguageProvider } from "@/i18n/LanguageProvider";

export default function Home() {
  return (
    <LanguageProvider>
      <KeyboardInsetManager />
      <TaskApp />
    </LanguageProvider>
  );
}

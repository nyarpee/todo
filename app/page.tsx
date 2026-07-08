import { TaskApp } from "@/components/TaskApp";
import { LanguageProvider } from "@/i18n/LanguageProvider";

export default function Home() {
  return (
    <LanguageProvider>
      <TaskApp />
    </LanguageProvider>
  );
}

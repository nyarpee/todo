alter table public.user_settings
drop constraint if exists user_settings_language_check;

update public.user_settings
set language = 'zh-CN'
where language = 'zh';

alter table public.user_settings
add constraint user_settings_language_check
check (language in ('en', 'ja', 'zh-CN', 'zh-TW'));

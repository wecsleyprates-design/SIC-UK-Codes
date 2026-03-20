update files.uploads set display_name = file_name where display_name is null;
alter table files.uploads alter column display_name set not null;
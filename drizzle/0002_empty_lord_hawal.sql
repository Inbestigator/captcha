CREATE TABLE `checks` (
	`id` text PRIMARY KEY NOT NULL,
	`user` text NOT NULL,
	`guild` text NOT NULL,
	`scores` text NOT NULL,
	`failed` integer NOT NULL,
	`created_at` integer NOT NULL
);

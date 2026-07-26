CREATE TABLE `trigger_roles` (
	`id` text NOT NULL,
	`guild` text NOT NULL,
	`fails` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`id`, `guild`)
);

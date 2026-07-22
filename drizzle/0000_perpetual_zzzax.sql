CREATE TABLE `settings` (
	`id` text PRIMARY KEY NOT NULL,
	`refresh` text,
	`actions` text DEFAULT '[]' NOT NULL,
	`logs` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `stages` (
	`id` text PRIMARY KEY NOT NULL,
	`guild` text NOT NULL,
	`theme` text NOT NULL,
	`incorrect` text NOT NULL,
	`correct` text NOT NULL,
	`created_at` integer NOT NULL,
	`fails` integer DEFAULT 0 NOT NULL
);

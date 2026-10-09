CREATE TABLE `safety_events` (
	`id` text PRIMARY KEY NOT NULL,
	`child_id` text,
	`kind` text NOT NULL,
	`severity` text NOT NULL,
	`source` text NOT NULL,
	`action_taken` text NOT NULL,
	`reviewed_by_parent` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`child_id`) REFERENCES `children`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_safety_child` ON `safety_events` (`child_id`,`created_at`);
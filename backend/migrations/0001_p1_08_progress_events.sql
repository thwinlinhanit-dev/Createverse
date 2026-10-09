CREATE TABLE `progress_events` (
	`event_id` text PRIMARY KEY NOT NULL,
	`child_id` text NOT NULL,
	`device_id` text NOT NULL,
	`type` text NOT NULL,
	`schema_version` integer NOT NULL,
	`occurred_at` text NOT NULL,
	`received_at` text NOT NULL,
	`content_id` text,
	`content_version` integer,
	`payload` text NOT NULL,
	FOREIGN KEY (`child_id`) REFERENCES `children`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_events_child_time` ON `progress_events` (`child_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `idx_events_type` ON `progress_events` (`child_id`,`type`);
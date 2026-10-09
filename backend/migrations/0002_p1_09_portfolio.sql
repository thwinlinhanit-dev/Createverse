CREATE TABLE `artifacts` (
	`id` text PRIMARY KEY NOT NULL,
	`child_id` text NOT NULL,
	`project_instance_id` text,
	`kind` text NOT NULL,
	`mime` text NOT NULL,
	`storage_key` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`meta` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`child_id`) REFERENCES `children`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_artifacts_child` ON `artifacts` (`child_id`);--> statement-breakpoint
CREATE TABLE `portfolio_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`child_id` text NOT NULL,
	`artifact_id` text NOT NULL,
	`project_instance_id` text,
	`title` text NOT NULL,
	`stage_at_creation` text NOT NULL,
	`skills` text NOT NULL,
	`concepts` text NOT NULL,
	`what_i_learned` text,
	`what_i_would_improve` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`child_id`) REFERENCES `children`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`artifact_id`) REFERENCES `artifacts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_portfolio_child` ON `portfolio_entries` (`child_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `portfolio_artifact_unique` ON `portfolio_entries` (`artifact_id`);
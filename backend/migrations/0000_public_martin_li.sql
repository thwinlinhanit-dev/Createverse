CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_type` text NOT NULL,
	`actor_id` text,
	`action` text NOT NULL,
	`target_type` text,
	`target_id` text,
	`at` text NOT NULL,
	`meta` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `audit_id_unique` ON `audit_log` (`id`);--> statement-breakpoint
CREATE TABLE `auth_challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`challenge` text NOT NULL,
	`purpose` text NOT NULL,
	`user_id` text,
	`family_id` text,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`consumed_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_challenges_challenge_unique` ON `auth_challenges` (`challenge`);--> statement-breakpoint
CREATE TABLE `child_settings` (
	`child_id` text PRIMARY KEY NOT NULL,
	`daily_minutes_limit` integer,
	`quiet_hours` text,
	`ai_mentor_enabled` integer DEFAULT 1 NOT NULL,
	`read_aloud_enabled` integer DEFAULT 1 NOT NULL,
	`project_approval_required` integer DEFAULT 0 NOT NULL,
	`allowed_risk_class` text DEFAULT 'low' NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`child_id`) REFERENCES `children`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `children` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`display_name` text NOT NULL,
	`avatar_key` text,
	`stage` text NOT NULL,
	`birth_year` integer,
	`locale` text DEFAULT 'en' NOT NULL,
	`ui_preset` text NOT NULL,
	`pin_hash` text,
	`pin_failed_attempts` integer DEFAULT 0 NOT NULL,
	`pin_locked_until` text,
	`created_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `children_family_idx` ON `children` (`family_id`);--> statement-breakpoint
CREATE TABLE `devices` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`label` text,
	`credential_hash` text,
	`created_at` text NOT NULL,
	`last_sync_at` text,
	`revoked_at` text,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `devices_family_idx` ON `devices` (`family_id`);--> statement-breakpoint
CREATE TABLE `families` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `passkey_credentials` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`public_key` blob NOT NULL,
	`sign_count` integer DEFAULT 0 NOT NULL,
	`label` text,
	`created_at` text NOT NULL,
	`last_used_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `passkeys_user_idx` ON `passkey_credentials` (`user_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`child_id` text,
	`family_id` text NOT NULL,
	`device_id` text,
	`kind` text NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`fresh_at` text,
	`revoked_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_unique` ON `sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `sessions_family_idx` ON `sessions` (`family_id`);--> statement-breakpoint
CREATE TABLE `setup_secrets` (
	`id` text PRIMARY KEY NOT NULL,
	`secret_hash` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`used_at` text
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text,
	`role` text NOT NULL,
	`created_at` text NOT NULL,
	`last_login_at` text,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);
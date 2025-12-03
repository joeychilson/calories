import { boolean, index, integer, pgTable, real, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const users = pgTable(
	'users',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		name: text('name').notNull(),
		email: text('email').notNull().unique(),
		emailVerified: boolean('email_verified')
			.$defaultFn(() => false)
			.notNull(),
		image: text('image'),
		createdAt: timestamp('created_at')
			.$defaultFn(() => new Date())
			.notNull(),
		updatedAt: timestamp('updated_at')
			.$defaultFn(() => new Date())
			.notNull()
	},
	(table) => [index('users_email_idx').on(table.email)]
);

export const sessions = pgTable(
	'sessions',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		token: text('token').notNull().unique(),
		expiresAt: timestamp('expires_at').notNull(),
		ipAddress: text('ip_address'),
		userAgent: text('user_agent'),
		createdAt: timestamp('created_at')
			.$defaultFn(() => new Date())
			.notNull(),
		updatedAt: timestamp('updated_at')
			.$defaultFn(() => new Date())
			.notNull()
	},
	(table) => [
		index('sessions_user_id_idx').on(table.userId),
		index('sessions_token_idx').on(table.token)
	]
);

export const accounts = pgTable(
	'accounts',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		accountId: text('account_id').notNull(),
		providerId: text('provider_id').notNull(),
		password: text('password'),
		scope: text('scope'),
		idToken: text('id_token'),
		accessToken: text('access_token'),
		accessTokenExpiresAt: timestamp('access_token_expires_at'),
		refreshToken: text('refresh_token'),
		refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
		createdAt: timestamp('created_at')
			.$defaultFn(() => new Date())
			.notNull(),
		updatedAt: timestamp('updated_at')
			.$defaultFn(() => new Date())
			.notNull()
	},
	(table) => [index('accounts_user_id_idx').on(table.userId)]
);

export const verifications = pgTable(
	'verifications',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		identifier: text('identifier').notNull(),
		value: text('value').notNull(),
		expiresAt: timestamp('expires_at').notNull(),
		createdAt: timestamp('created_at')
			.$defaultFn(() => new Date())
			.notNull(),
		updatedAt: timestamp('updated_at')
			.$defaultFn(() => new Date())
			.notNull()
	},
	(table) => [index('verifications_identifier_idx').on(table.identifier)]
);

export const subscriptions = pgTable(
	'subscriptions',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.unique()
			.references(() => users.id, { onDelete: 'cascade' }),
		stripeCustomerId: text('stripe_customer_id'),
		onboardingCompleted: boolean('onboarding_completed').default(false).notNull(),
		paid: boolean('paid').default(false).notNull(),
		paidAt: timestamp('paid_at'),
		createdAt: timestamp('created_at')
			.$defaultFn(() => new Date())
			.notNull(),
		updatedAt: timestamp('updated_at')
			.$defaultFn(() => new Date())
			.notNull()
	},
	(table) => [index('subscriptions_user_id_idx').on(table.userId)]
);

export const profiles = pgTable(
	'profiles',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.unique()
			.references(() => users.id, { onDelete: 'cascade' }),
		sex: text('sex'),
		birthDate: timestamp('birth_date'),
		height: real('height'),
		units: text('units').default('imperial').notNull(),
		weightGoal: real('weight_goal'),
		calorieGoal: integer('calorie_goal').default(2000).notNull(),
		waterGoal: integer('water_goal').default(64).notNull(),
		activityLevel: text('activity_level').default('moderate').notNull(),
		createdAt: timestamp('created_at')
			.$defaultFn(() => new Date())
			.notNull(),
		updatedAt: timestamp('updated_at')
			.$defaultFn(() => new Date())
			.notNull()
	},
	(table) => [index('profiles_user_id_idx').on(table.userId)]
);

export const mealLogs = pgTable(
	'meal_logs',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		servings: real('servings').default(1).notNull(),
		calories: integer('calories').notNull(),
		protein: integer('protein'),
		carbs: integer('carbs'),
		fat: integer('fat'),
		image: text('image'),
		mealDate: text('meal_date').notNull(),
		mealTime: timestamp('meal_time', { withTimezone: true }).notNull(),
		createdAt: timestamp('created_at')
			.$defaultFn(() => new Date())
			.notNull(),
		updatedAt: timestamp('updated_at')
			.$defaultFn(() => new Date())
			.notNull()
	},
	(table) => [
		index('meals_user_id_idx').on(table.userId),
		index('meals_meal_date_idx').on(table.mealDate),
		index('meals_meal_time_idx').on(table.mealTime)
	]
);

export const weightLogs = pgTable(
	'weight_logs',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		weight: real('weight').notNull(),
		date: timestamp('date').notNull(),
		createdAt: timestamp('created_at')
			.$defaultFn(() => new Date())
			.notNull(),
		updatedAt: timestamp('updated_at')
			.$defaultFn(() => new Date())
			.notNull()
	},
	(table) => [index('weight_logs_user_id_idx').on(table.userId)]
);

export const waterLogs = pgTable(
	'water_logs',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		amount: integer('amount').notNull(),
		date: text('date').notNull(),
		createdAt: timestamp('created_at')
			.$defaultFn(() => new Date())
			.notNull(),
		updatedAt: timestamp('updated_at')
			.$defaultFn(() => new Date())
			.notNull()
	},
	(table) => [
		index('water_logs_user_id_idx').on(table.userId),
		index('water_logs_date_idx').on(table.date)
	]
);

export const foodPreferences = pgTable(
	'food_preferences',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		category: text('category').notNull(),
		value: text('value').notNull(),
		notes: text('notes'),
		createdAt: timestamp('created_at')
			.$defaultFn(() => new Date())
			.notNull(),
		updatedAt: timestamp('updated_at')
			.$defaultFn(() => new Date())
			.notNull()
	},
	(table) => [
		index('food_preferences_user_id_idx').on(table.userId),
		index('food_preferences_category_idx').on(table.category)
	]
);

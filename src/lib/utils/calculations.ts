export const activityMultipliers: Record<string, number> = {
	sedentary: 1.2,
	light: 1.375,
	moderate: 1.55,
	active: 1.725,
	very_active: 1.9
};

export function calculateAge(birthDate: string | Date | null): number {
	if (!birthDate) return 30;
	const birth = typeof birthDate === 'string' ? new Date(birthDate) : birthDate;
	const today = new Date();
	let age = today.getFullYear() - birth.getFullYear();
	const monthDiff = today.getMonth() - birth.getMonth();
	if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
		age--;
	}
	return age;
}

export function calculateBMR(
	heightCm: number,
	weightKg: number,
	age: number,
	sex: string | null
): number {
	if (!heightCm || !weightKg) return 0;
	if (sex === 'male') {
		return 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
	} else if (sex === 'female') {
		return 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
	}
	return 10 * weightKg + 6.25 * heightCm - 5 * age - 78;
}

export function calculateTDEE(bmr: number, activityLevel: string): number {
	return Math.round(bmr * (activityMultipliers[activityLevel] ?? 1.55));
}

export function calculateCalorieGoal(
	tdee: number,
	currentWeight: number,
	goalWeight: number | null
): number {
	if (!tdee) return 2000;
	if (goalWeight && currentWeight) {
		if (goalWeight < currentWeight) {
			return Math.max(1200, tdee - 500);
		} else if (goalWeight > currentWeight) {
			return tdee + 500;
		}
	}
	return tdee;
}

export function calculateWaterGoal(weightLbs: number, units: 'imperial' | 'metric'): number {
	const ozGoal = Math.max(64, Math.round(weightLbs * 0.5));
	if (units === 'metric') {
		return Math.round((ozGoal * 29.5735) / 100) * 100;
	}
	return ozGoal;
}

export function lbsToKg(lbs: number): number {
	return lbs * 0.453592;
}

export function kgToLbs(kg: number): number {
	return kg * 2.205;
}

export function cmToInches(cm: number): number {
	return cm / 2.54;
}

export function inchesToCm(feet: number, inches: number): number {
	return (feet * 12 + inches) * 2.54;
}

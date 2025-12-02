export function parseLocalDate(dateStr: string): Date {
	const [year, month, day] = dateStr.split('-').map(Number);
	return new Date(year, month - 1, day);
}

export function formatTimeAgo(date: Date): string {
	const diff = Date.now() - date.getTime();
	const minutes = Math.floor(diff / 60000);
	const hours = Math.floor(diff / 3600000);
	const days = Math.floor(diff / 86400000);

	if (days > 0) return `${days}d ago`;
	if (hours > 0) return `${hours}h ago`;
	if (minutes > 0) return `${minutes}m ago`;
	return 'Just now';
}

export function formatDate(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

export function getDisplayDate(date: Date): string {
	const today = new Date();
	const yesterday = new Date(today);
	yesterday.setDate(yesterday.getDate() - 1);

	const dString = formatDate(date);
	const tString = formatDate(today);
	const yString = formatDate(yesterday);

	if (dString === tString) return 'Today';
	if (dString === yString) return 'Yesterday';

	return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function formatTime(timestamp: number): string {
	const date = new Date(timestamp);
	const hours = date.getHours();
	const minutes = date.getMinutes();
	const ampm = hours >= 12 ? 'PM' : 'AM';
	const displayHours = hours % 12 || 12;
	const displayMinutes = minutes.toString().padStart(2, '0');
	return `${displayHours}:${displayMinutes} ${ampm}`;
}

export class SerializableMap<K, V> extends Map<K, V> {
	toJSON() {
		return Object.fromEntries(this);
	}
}

export class SerializableSet<T> extends Set<T> {
	toJSON() {
		return Array.from(this);
	}
}

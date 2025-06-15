
export function getCategoryColor(category: string) {
  switch (category?.toLowerCase()) {
    case 'chatgpt':
      return '#c49d68';
    case 'midjourney':
      return '#7a9e9f';
    case 'workflow':
      return '#8b7fb8';
    default:
      return '#c49d68';
  }
}

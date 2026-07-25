import PublishingQueue from "./PublishingQueue";

export default function ReviewQueuePage() {
  return (
    <PublishingQueue
      mode="review"
      title="Review queue / قائمة المراجعة"
      subtitle="Resources awaiting editorial approval. Approve & publish once validation and scan gates are green, return to draft for changes, or archive."
    />
  );
}

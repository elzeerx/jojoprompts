import PublishingQueue from "./PublishingQueue";

export default function DraftsQueuePage() {
  return (
    <PublishingQueue
      mode="draft"
      title="Drafts / المسودات"
      subtitle="Resources still being authored. Continue editing, or submit for review once metadata, package, scan, and pricing are ready."
    />
  );
}


import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useCategories } from "@/hooks/useCategories";
import { CategoriesTable } from "./CategoriesTable";
import { CategoryDialog } from "./CategoryDialog";
import { Category } from "@/types/category";

export function CategoriesManagement() {
  const { categories, loading, createCategory, updateCategory, deleteCategory } = useCategories();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const handleCreateCategory = () => {
    setEditingCategory(null);
    setIsDialogOpen(true);
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingCategory(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Categories Management</h2>
          <p className="text-muted-foreground">
            Manage prompt categories and their visibility
          </p>
        </div>
        <Button onClick={handleCreateCategory}>
          <Plus className="h-4 w-4 mr-2" />
          Add Category
        </Button>
      </div>

      <CategoriesTable
        categories={categories}
        loading={loading}
        onEdit={handleEditCategory}
        onDelete={deleteCategory}
        onToggleActive={updateCategory}
      />

      <CategoryDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        category={editingCategory}
        onSave={editingCategory ? updateCategory : createCategory}
        onClose={handleCloseDialog}
      />
    </div>
  );
}

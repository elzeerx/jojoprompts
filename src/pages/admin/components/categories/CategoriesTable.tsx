
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Edit, Eye, EyeOff } from "lucide-react";
import { Category } from "@/types/category";

interface CategoriesTableProps {
  categories: Category[];
  loading: boolean;
  onEdit: (category: Category) => void;
  onToggleActive: (id: string, data: Partial<Category>) => void;
}

export function CategoriesTable({
  categories,
  loading,
  onEdit,
  onToggleActive,
}: CategoriesTableProps) {
  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="text-muted-foreground">Loading categories...</div>
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No categories found</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table className="min-w-[760px]">
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Catalog path</TableHead>
            <TableHead>Filter labels</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Order</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {categories.map((category) => (
            <TableRow key={category.id}>
              <TableCell>
                <div className="flex items-center space-x-3">
                  {category.image_path && (
                    <img
                      src={category.image_path}
                      alt={category.name}
                      className="w-10 h-10 rounded object-cover"
                    />
                  )}
                  <div>
                    <div className="font-medium">{category.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {category.description
                        ? `${category.description.substring(0, 70)}${category.description.length > 70 ? "…" : ""}`
                        : "No description"}
                    </div>
                  </div>
                </div>
              </TableCell>
              <TableCell><code className="text-xs">{category.link_path}</code></TableCell>
              <TableCell>
                <div className="text-sm text-muted-foreground">
                  {category.subcategories.length} label{category.subcategories.length === 1 ? "" : "s"}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={category.is_active}
                    aria-label={`${category.is_active ? "Deactivate" : "Activate"} ${category.name}`}
                    onCheckedChange={(checked) =>
                      onToggleActive(category.id, { is_active: checked })
                    }
                  />
                  {category.is_active ? (
                    <Eye className="h-4 w-4 text-green-500" />
                  ) : (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  )}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="secondary">{category.display_order}</Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label="Edit category"
                    className="min-h-[44px] min-w-[44px]"
                    onClick={() => onEdit(category)}
                  >
                    <Edit className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

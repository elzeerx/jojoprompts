
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
import { Edit, Trash2, Eye, EyeOff } from "lucide-react";
import { Category } from "@/types/category";

interface CategoriesTableProps {
  categories: Category[];
  loading: boolean;
  onEdit: (category: Category) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, data: Partial<Category>) => void;
}

export function CategoriesTable({
  categories,
  loading,
  onEdit,
  onDelete,
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
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Plan Required</TableHead>
            <TableHead>Features</TableHead>
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
                      {category.description?.substring(0, 50)}...
                    </div>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="capitalize">
                  {category.required_plan}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="text-sm text-muted-foreground">
                  {category.features.length} features
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={category.is_active}
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
                    onClick={() => onEdit(category)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onDelete(category.id)}
                  >
                    <Trash2 className="h-4 w-4" />
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

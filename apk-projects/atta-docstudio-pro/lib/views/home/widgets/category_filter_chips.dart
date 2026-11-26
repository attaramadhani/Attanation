import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../models/pdf_tool_item.dart';

class CategoryFilterChips extends StatelessWidget {
  final ToolCategory selectedCategory;
  final ValueChanged<ToolCategory> onSelected;

  const CategoryFilterChips({
    super.key,
    required this.selectedCategory,
    required this.onSelected,
  });

  @override
  Widget build(BuildContext context) {
    final surface = AppColors.surfaceOf(context);
    final line = AppColors.lineOf(context);
    final ink = AppColors.inkOf(context);
    final muted = AppColors.mutedOf(context);

    return SizedBox(
      height: 44,
      child: ListView.separated(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        scrollDirection: Axis.horizontal,
        itemCount: ToolCategory.values.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          final cat = ToolCategory.values[index];
          final isSelected = selectedCategory == cat;

          return FilterChip(
            selected: isSelected,
            showCheckmark: false,
            avatar: Icon(
              cat.icon,
              size: 16,
              color: isSelected ? Colors.white : muted,
            ),
            label: Text(
              cat.label,
              style: TextStyle(
                fontSize: 13,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                color: isSelected ? Colors.white : ink,
              ),
            ),
            backgroundColor: surface,
            selectedColor: AppColors.primaryBlue,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(20),
              side: BorderSide(
                color: isSelected ? AppColors.primaryBlue : line,
              ),
            ),
            onSelected: (_) => onSelected(cat),
          );
        },
      ),
    );
  }
}

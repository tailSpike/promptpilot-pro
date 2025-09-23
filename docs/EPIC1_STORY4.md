# Epic 1 Story 4: Enhanced Metadata & Preview System

**Status:** 📋 NOT STARTED
**User Story:** As a user, I want comprehensive tagging, real-time preview, and advanced filtering so I can efficiently manage and discover prompts.

## Overview
This story completes the missing functionality from Stories 1 and 2 by implementing the tags/categories system, real-time preview capabilities, and advanced filtering. This will elevate the prompt management experience from functional to highly sophisticated.

## Acceptance Criteria

### Tags & Categories System
- ❌ **Tag Management**: Users can create, edit, and delete custom tags for prompts
- ❌ **Category System**: Predefined categories (e.g., "Writing", "Analysis", "Code", "Research") with custom category creation
- ❌ **Multi-tag Support**: Prompts can have multiple tags and belong to multiple categories
- ❌ **Tag Autocomplete**: Intelligent tag suggestions based on existing tags and prompt content
- ❌ **Tag Hierarchy**: Support for nested tags (e.g., "Code > Python > Data Science")
- ❌ **Color Coding**: Visual color coding for tags and categories for quick identification

### Real-time Preview System
- ❌ **Live Variable Substitution**: Real-time preview shows how prompt will look with current variable values
- ❌ **Split-pane Interface**: Side-by-side editor and preview with synchronized scrolling
- ❌ **Variable Highlighting**: Visual highlighting of variables in both editor and preview
- ❌ **Preview Modes**: Multiple preview modes (Raw, Formatted, Token Count, Character Count)
- ❌ **Validation Feedback**: Real-time validation with inline error highlighting
- ❌ **Test Data**: Ability to save and load test variable sets for consistent previewing

### Advanced Filtering & Search
- ❌ **Multi-criteria Search**: Search by name, content, tags, categories, and variables
- ❌ **Filter Combinations**: Combine folder, tag, category, and date filters
- ❌ **Smart Search**: Semantic search capabilities that understand intent
- ❌ **Search History**: Recently used search terms and filters
- ❌ **Saved Searches**: Save frequently used search/filter combinations
- ❌ **Quick Filters**: One-click filters for common searches (Recent, Favorites, Untagged)

## Technical Implementation

### Database Schema Updates
```sql
-- Add tags table
CREATE TABLE prompt_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    color VARCHAR(7), -- Hex color code
    parent_id UUID REFERENCES prompt_tags(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Add categories table
CREATE TABLE prompt_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    color VARCHAR(7),
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Add many-to-many relationships
CREATE TABLE prompt_tag_assignments (
    prompt_id UUID REFERENCES prompts(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES prompt_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (prompt_id, tag_id)
);

CREATE TABLE prompt_category_assignments (
    prompt_id UUID REFERENCES prompts(id) ON DELETE CASCADE,
    category_id UUID REFERENCES prompt_categories(id) ON DELETE CASCADE,
    PRIMARY KEY (prompt_id, category_id)
);
```

### Frontend Components
- `TagManager.tsx` - Tag creation and management interface
- `TagInput.tsx` - Multi-select tag input with autocomplete
- `CategorySelector.tsx` - Category selection component
- `PromptPreview.tsx` - Real-time preview with variable substitution
- `AdvancedSearch.tsx` - Comprehensive search and filter interface
- `FilterBar.tsx` - Quick filter buttons and active filter display

### Backend API Endpoints
- `GET/POST/PUT/DELETE /api/tags` - Tag CRUD operations
- `GET/POST/PUT/DELETE /api/categories` - Category CRUD operations
- `POST /api/prompts/{id}/tags` - Assign/remove tags from prompt
- `POST /api/prompts/{id}/categories` - Assign/remove categories from prompt
- `GET /api/search/prompts` - Advanced search with multiple criteria
- `POST /api/prompts/{id}/preview` - Generate preview with variable substitution

## User Experience Flow

### Tagging Workflow
1. User creates/edits prompt
2. Tag input shows autocomplete suggestions
3. User selects existing tags or creates new ones
4. Tags appear as colored chips with removal option
5. Tags are immediately searchable and filterable

### Preview Workflow
1. User edits prompt in left pane
2. Preview updates in real-time in right pane
3. Variable values can be adjusted in sidebar
4. Preview shows exactly how prompt will appear
5. Validation errors highlight problematic areas

### Search Workflow
1. User opens advanced search
2. Multiple filter criteria can be combined
3. Results update in real-time as filters change
4. Search can be saved for future use
5. Quick filters provide common searches

## Definition of Done
- [ ] All acceptance criteria implemented and tested
- [ ] Database schema updated with proper indexes
- [ ] Frontend components fully responsive
- [ ] API endpoints documented in OpenAPI spec
- [ ] Unit tests achieve >90% coverage
- [ ] Integration tests cover all user workflows
- [ ] Performance benchmarks meet requirements (<200ms search)
- [ ] Accessibility compliance (WCAG 2.1 AA)
- [ ] User documentation updated
- [ ] Migration scripts for existing data

## Dependencies
- **Story 1**: Variable system must be complete for preview functionality
- **Story 2**: Folder system must be complete for combined filtering
- **Database**: Schema migrations for new tables
- **Search Engine**: May require Elasticsearch integration for semantic search

## Effort Estimation
- **Backend API**: 3-4 days
- **Database Schema**: 1 day
- **Frontend Components**: 5-6 days
- **Integration & Testing**: 2-3 days
- **Documentation**: 1 day
- **Total**: 12-15 days

## Success Metrics
- Users can find any prompt within 3 seconds using search
- 90% of prompts are tagged within 1 week of creation
- Preview reduces prompt iteration time by 40%
- Search success rate >95% for common queries

## Notes
This story transforms PromptPilot Pro from a basic prompt manager into a sophisticated content management system. The combination of tagging, real-time preview, and advanced search creates a professional-grade experience that scales with user needs.
export type Json =
	| string
	| number
	| boolean
	| null
	| { [key: string]: Json | undefined }
	| Json[];

export type Database = {
	graphql_public: {
		Tables: {
			[_ in never]: never;
		};
		Views: {
			[_ in never]: never;
		};
		Functions: {
			graphql: {
				Args: {
					extensions?: Json;
					operationName?: string;
					query?: string;
					variables?: Json;
				};
				Returns: Json;
			};
		};
		Enums: {
			[_ in never]: never;
		};
		CompositeTypes: {
			[_ in never]: never;
		};
	};
	public: {
		Tables: {
			sitecue_diaries: {
				Row: {
					content: string;
					created_at: string;
					date: string;
					topics: string[];
					updated_at: string;
					user_id: string;
				};
				Insert: {
					content?: string;
					created_at?: string;
					date: string;
					topics?: string[];
					updated_at?: string;
					user_id: string;
				};
				Update: {
					content?: string;
					created_at?: string;
					date?: string;
					topics?: string[];
					updated_at?: string;
					user_id?: string;
				};
				Relationships: [];
			};
			sitecue_domain_settings: {
				Row: {
					color: string | null;
					created_at: string;
					domain: string;
					id: string;
					label: string | null;
					updated_at: string;
					user_id: string;
				};
				Insert: {
					color?: string | null;
					created_at?: string;
					domain: string;
					id?: string;
					label?: string | null;
					updated_at?: string;
					user_id: string;
				};
				Update: {
					color?: string | null;
					created_at?: string;
					domain?: string;
					id?: string;
					label?: string | null;
					updated_at?: string;
					user_id?: string;
				};
				Relationships: [];
			};
			sitecue_drafts: {
				Row: {
					content: string | null;
					created_at: string;
					id: string;
					metadata: Json | null;
					tags: string[] | null;
					template_id: string | null;
					title: string | null;
					updated_at: string;
					user_id: string;
				};
				Insert: {
					content?: string | null;
					created_at?: string;
					id?: string;
					metadata?: Json | null;
					tags?: string[] | null;
					template_id?: string | null;
					title?: string | null;
					updated_at?: string;
					user_id?: string;
				};
				Update: {
					content?: string | null;
					created_at?: string;
					id?: string;
					metadata?: Json | null;
					tags?: string[] | null;
					template_id?: string | null;
					title?: string | null;
					updated_at?: string;
					user_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: "sitecue_drafts_template_id_fkey";
						columns: ["template_id"];
						isOneToOne: false;
						referencedRelation: "sitecue_templates";
						referencedColumns: ["id"];
					},
				];
			};
			sitecue_links: {
				Row: {
					created_at: string;
					domain: string;
					id: string;
					label: string;
					target_url: string;
					type: string;
					user_id: string;
				};
				Insert: {
					created_at?: string;
					domain: string;
					id?: string;
					label: string;
					target_url: string;
					type: string;
					user_id?: string;
				};
				Update: {
					created_at?: string;
					domain?: string;
					id?: string;
					label?: string;
					target_url?: string;
					type?: string;
					user_id?: string;
				};
				Relationships: [];
			};
			sitecue_notes: {
				Row: {
					content: string;
					created_at: string;
					draft_id: string | null;
					id: string;
					is_expanded: boolean;
					is_favorite: boolean;
					is_pinned: boolean;
					is_resolved: boolean;
					note_type: string;
					scope: string;
					sort_order: number;
					tags: string[] | null;
					updated_at: string;
					url_pattern: string;
					user_id: string;
				};
				Insert: {
					content: string;
					created_at?: string;
					draft_id?: string | null;
					id?: string;
					is_expanded?: boolean;
					is_favorite?: boolean;
					is_pinned?: boolean;
					is_resolved?: boolean;
					note_type?: string;
					scope?: string;
					sort_order?: number;
					tags?: string[] | null;
					updated_at?: string;
					url_pattern: string;
					user_id: string;
				};
				Update: {
					content?: string;
					created_at?: string;
					draft_id?: string | null;
					id?: string;
					is_expanded?: boolean;
					is_favorite?: boolean;
					is_pinned?: boolean;
					is_resolved?: boolean;
					note_type?: string;
					scope?: string;
					sort_order?: number;
					tags?: string[] | null;
					updated_at?: string;
					url_pattern?: string;
					user_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: "sitecue_notes_draft_id_fkey";
						columns: ["draft_id"];
						isOneToOne: false;
						referencedRelation: "sitecue_drafts";
						referencedColumns: ["id"];
					},
				];
			};
			sitecue_pinned_sites: {
				Row: {
					created_at: string;
					id: string;
					title: string;
					url: string;
					user_id: string;
				};
				Insert: {
					created_at?: string;
					id?: string;
					title: string;
					url: string;
					user_id?: string;
				};
				Update: {
					created_at?: string;
					id?: string;
					title?: string;
					url?: string;
					user_id?: string;
				};
				Relationships: [];
			};
			sitecue_profiles: {
				Row: {
					ai_usage_count: number;
					ai_usage_reset_at: string | null;
					created_at: string;
					id: string;
					plan: string;
				};
				Insert: {
					ai_usage_count?: number;
					ai_usage_reset_at?: string | null;
					created_at?: string;
					id: string;
					plan?: string;
				};
				Update: {
					ai_usage_count?: number;
					ai_usage_reset_at?: string | null;
					created_at?: string;
					id?: string;
					plan?: string;
				};
				Relationships: [];
			};
			sitecue_templates: {
				Row: {
					boilerplate: string | null;
					created_at: string;
					icon: string | null;
					id: string;
					max_length: number | null;
					name: string;
					updated_at: string;
					user_id: string;
					weave_prompt: string | null;
				};
				Insert: {
					boilerplate?: string | null;
					created_at?: string;
					icon?: string | null;
					id?: string;
					max_length?: number | null;
					name: string;
					updated_at?: string;
					user_id: string;
					weave_prompt?: string | null;
				};
				Update: {
					boilerplate?: string | null;
					created_at?: string;
					icon?: string | null;
					id?: string;
					max_length?: number | null;
					name?: string;
					updated_at?: string;
					user_id?: string;
					weave_prompt?: string | null;
				};
				Relationships: [];
			};
			todo01_profiles: {
				Row: {
					created_at: string;
					display_name: string | null;
					id: string;
					updated_at: string;
				};
				Insert: {
					created_at?: string;
					display_name?: string | null;
					id: string;
					updated_at?: string;
				};
				Update: {
					created_at?: string;
					display_name?: string | null;
					id?: string;
					updated_at?: string;
				};
				Relationships: [];
			};
			todo01_tasks: {
				Row: {
					created_at: string;
					id: string;
					is_complete: boolean | null;
					title: string;
					user_id: string;
				};
				Insert: {
					created_at?: string;
					id?: string;
					is_complete?: boolean | null;
					title: string;
					user_id: string;
				};
				Update: {
					created_at?: string;
					id?: string;
					is_complete?: boolean | null;
					title?: string;
					user_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: "todo01_tasks_user_id_fkey";
						columns: ["user_id"];
						isOneToOne: false;
						referencedRelation: "todo01_profiles";
						referencedColumns: ["id"];
					},
				];
			};
		};
		Views: {
			[_ in never]: never;
		};
		Functions: {
			check_array_elements_length: {
				Args: { arr: string[]; max_len: number };
				Returns: boolean;
			};
			get_dashboard_domain_activity: {
				Args: { p_limit?: number; p_user_id: string };
				Returns: Json;
			};
			get_drafts_by_date: {
				Args: { p_date: string; p_user_id: string };
				Returns: {
					content: string | null;
					created_at: string;
					id: string;
					metadata: Json | null;
					tags: string[] | null;
					template_id: string | null;
					title: string | null;
					updated_at: string;
					user_id: string;
				}[];
				SetofOptions: {
					from: "*";
					to: "sitecue_drafts";
					isOneToOne: false;
					isSetofReturn: true;
				};
			};
			get_matching_active_note_count: {
				Args: { p_domain: string; p_exact: string };
				Returns: number;
			};
			get_matching_notes: {
				Args: { p_domain: string; p_exact: string };
				Returns: {
					content: string;
					created_at: string;
					draft_id: string | null;
					id: string;
					is_expanded: boolean;
					is_favorite: boolean;
					is_pinned: boolean;
					is_resolved: boolean;
					note_type: string;
					scope: string;
					sort_order: number;
					tags: string[] | null;
					updated_at: string;
					url_pattern: string;
					user_id: string;
				}[];
				SetofOptions: {
					from: "*";
					to: "sitecue_notes";
					isOneToOne: false;
					isSetofReturn: true;
				};
			};
			get_notes_by_date: {
				Args: { p_date: string; p_user_id: string };
				Returns: {
					content: string;
					created_at: string;
					draft_id: string | null;
					id: string;
					is_expanded: boolean;
					is_favorite: boolean;
					is_pinned: boolean;
					is_resolved: boolean;
					note_type: string;
					scope: string;
					sort_order: number;
					tags: string[] | null;
					updated_at: string;
					url_pattern: string;
					user_id: string;
				}[];
				SetofOptions: {
					from: "*";
					to: "sitecue_notes";
					isOneToOne: false;
					isSetofReturn: true;
				};
			};
			search_drafts: {
				Args: { search_query: string };
				Returns: {
					content: string | null;
					created_at: string;
					id: string;
					metadata: Json | null;
					tags: string[] | null;
					template_id: string | null;
					title: string | null;
					updated_at: string;
					user_id: string;
				}[];
				SetofOptions: {
					from: "*";
					to: "sitecue_drafts";
					isOneToOne: false;
					isSetofReturn: true;
				};
			};
			search_notes: {
				Args: { search_query: string };
				Returns: {
					content: string;
					created_at: string;
					draft_id: string | null;
					id: string;
					is_expanded: boolean;
					is_favorite: boolean;
					is_pinned: boolean;
					is_resolved: boolean;
					note_type: string;
					scope: string;
					sort_order: number;
					tags: string[] | null;
					updated_at: string;
					url_pattern: string;
					user_id: string;
				}[];
				SetofOptions: {
					from: "*";
					to: "sitecue_notes";
					isOneToOne: false;
					isSetofReturn: true;
				};
			};
		};
		Enums: {
			[_ in never]: never;
		};
		CompositeTypes: {
			[_ in never]: never;
		};
	};
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
	keyof Database,
	"public"
>];

export type Tables<
	DefaultSchemaTableNameOrOptions extends
		| keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
		| { schema: keyof DatabaseWithoutInternals },
	TableName extends DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
				DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
		: never = never,
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
			DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
			Row: infer R;
		}
		? R
		: never
	: DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
				DefaultSchema["Views"])
		? (DefaultSchema["Tables"] &
				DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
				Row: infer R;
			}
			? R
			: never
		: never;

export type TablesInsert<
	DefaultSchemaTableNameOrOptions extends
		| keyof DefaultSchema["Tables"]
		| { schema: keyof DatabaseWithoutInternals },
	TableName extends DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
		: never = never,
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
			Insert: infer I;
		}
		? I
		: never
	: DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
		? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
				Insert: infer I;
			}
			? I
			: never
		: never;

export type TablesUpdate<
	DefaultSchemaTableNameOrOptions extends
		| keyof DefaultSchema["Tables"]
		| { schema: keyof DatabaseWithoutInternals },
	TableName extends DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
		: never = never,
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
			Update: infer U;
		}
		? U
		: never
	: DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
		? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
				Update: infer U;
			}
			? U
			: never
		: never;

export type Enums<
	DefaultSchemaEnumNameOrOptions extends
		| keyof DefaultSchema["Enums"]
		| { schema: keyof DatabaseWithoutInternals },
	EnumName extends DefaultSchemaEnumNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
		: never = never,
> = DefaultSchemaEnumNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
	: DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
		? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
		: never;

export type CompositeTypes<
	PublicCompositeTypeNameOrOptions extends
		| keyof DefaultSchema["CompositeTypes"]
		| { schema: keyof DatabaseWithoutInternals },
	CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
		: never = never,
> = PublicCompositeTypeNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
	: PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
		? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
		: never;

export const Constants = {
	graphql_public: {
		Enums: {},
	},
	public: {
		Enums: {},
	},
} as const;

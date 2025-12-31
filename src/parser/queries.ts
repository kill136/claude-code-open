/**
 * Tree-sitter Query definitions for symbol extraction
 * Each language has queries for different symbol types
 */

import { SymbolKind } from './index.js';

export type QueryDefinition = {
  [K in SymbolKind]?: string;
};

/**
 * Query definitions for each supported language
 */
export const LANGUAGE_QUERIES: Record<string, QueryDefinition> = {
  javascript: {
    function: `
      [
        (function_declaration
          name: (identifier) @name) @definition
        (function_expression
          name: (identifier)? @name) @definition
        (arrow_function) @definition
        (generator_function_declaration
          name: (identifier) @name) @definition
      ]
    `,
    class: `
      [
        (class_declaration
          name: (identifier) @name
          body: (class_body) @body) @definition
        (class_expression
          name: (identifier)? @name
          body: (class_body) @body) @definition
      ]
    `,
    method: `
      (method_definition
        name: (property_identifier) @name
        parameters: (formal_parameters) @params
        body: (_) @body) @definition
    `,
    variable: `
      (variable_declarator
        name: (identifier) @name
        value: (_)? @value) @definition
    `,
    constant: `
      (variable_declaration
        kind: "const"
        (variable_declarator
          name: (identifier) @name
          value: (_)? @value) @definition)
    `,
    import: `
      [
        (import_statement) @definition
        (import_clause
          (identifier) @name) @definition
      ]
    `,
    export: `
      (export_statement) @definition
    `,
  },

  typescript: {
    function: `
      [
        (function_declaration
          name: (identifier) @name
          parameters: (formal_parameters) @params
          return_type: (type_annotation)? @return) @definition
        (function_expression
          name: (identifier)? @name
          parameters: (formal_parameters) @params
          return_type: (type_annotation)? @return) @definition
        (arrow_function
          parameters: (_) @params
          return_type: (type_annotation)? @return) @definition
      ]
    `,
    class: `
      [
        (class_declaration
          name: (type_identifier) @name
          body: (class_body) @body) @definition
        (abstract_class_declaration
          name: (type_identifier) @name
          body: (class_body) @body) @definition
      ]
    `,
    method: `
      [
        (method_definition
          name: (property_identifier) @name
          parameters: (formal_parameters) @params
          return_type: (type_annotation)? @return) @definition
        (method_signature
          name: (property_identifier) @name
          parameters: (formal_parameters) @params
          return_type: (type_annotation)? @return) @definition
      ]
    `,
    interface: `
      (interface_declaration
        name: (type_identifier) @name
        body: (interface_body) @body) @definition
    `,
    type: `
      (type_alias_declaration
        name: (type_identifier) @name
        value: (_) @value) @definition
    `,
    enum: `
      (enum_declaration
        name: (identifier) @name
        body: (enum_body) @body) @definition
    `,
    property: `
      [
        (property_signature
          name: (property_identifier) @name
          type: (type_annotation)? @type) @definition
        (public_field_definition
          name: (property_identifier) @name
          type: (type_annotation)? @type) @definition
      ]
    `,
    variable: `
      (variable_declarator
        name: (identifier) @name
        type: (type_annotation)? @type
        value: (_)? @value) @definition
    `,
    import: `
      [
        (import_statement) @definition
        (import_clause
          (identifier) @name) @definition
      ]
    `,
    export: `
      (export_statement) @definition
    `,
  },

  python: {
    function: `
      (function_definition
        name: (identifier) @name
        parameters: (parameters) @params
        return_type: (type)? @return
        body: (block) @body) @definition
    `,
    class: `
      (class_definition
        name: (identifier) @name
        superclasses: (argument_list)? @extends
        body: (block) @body) @definition
    `,
    method: `
      (class_definition
        body: (block
          (function_definition
            name: (identifier) @name
            parameters: (parameters) @params
            return_type: (type)? @return
            body: (block) @body) @definition))
    `,
    variable: `
      [
        (assignment
          left: (identifier) @name
          right: (_) @value) @definition
        (augmented_assignment
          left: (identifier) @name
          right: (_) @value) @definition
      ]
    `,
    import: `
      [
        (import_statement) @definition
        (import_from_statement) @definition
      ]
    `,
  },

  go: {
    function: `
      [
        (function_declaration
          name: (identifier) @name
          parameters: (parameter_list) @params
          result: (_)? @return
          body: (block) @body) @definition
        (method_declaration
          name: (field_identifier) @name
          parameters: (parameter_list) @params
          result: (_)? @return
          body: (block) @body) @definition
      ]
    `,
    type: `
      [
        (type_declaration
          (type_spec
            name: (type_identifier) @name
            type: (_) @value)) @definition
      ]
    `,
    interface: `
      (type_declaration
        (type_spec
          name: (type_identifier) @name
          type: (interface_type) @body)) @definition
    `,
    variable: `
      [
        (var_declaration
          (var_spec
            name: (identifier) @name
            type: (_)? @type
            value: (_)? @value)) @definition
        (const_declaration
          (const_spec
            name: (identifier) @name
            type: (_)? @type
            value: (_)? @value)) @definition
        (short_var_declaration
          left: (expression_list
            (identifier) @name)
          right: (_) @value) @definition
      ]
    `,
    import: `
      (import_declaration) @definition
    `,
  },

  rust: {
    function: `
      (function_item
        name: (identifier) @name
        parameters: (parameters) @params
        return_type: (type)? @return
        body: (block) @body) @definition
    `,
    class: `
      [
        (struct_item
          name: (type_identifier) @name
          body: (_)? @body) @definition
        (impl_item
          type: (type_identifier) @name
          body: (declaration_list) @body) @definition
      ]
    `,
    interface: `
      (trait_item
        name: (type_identifier) @name
        body: (declaration_list) @body) @definition
    `,
    type: `
      (type_item
        name: (type_identifier) @name
        type: (_) @value) @definition
    `,
    enum: `
      (enum_item
        name: (type_identifier) @name
        body: (enum_variant_list) @body) @definition
    `,
    variable: `
      [
        (let_declaration
          pattern: (identifier) @name
          type: (_)? @type
          value: (_)? @value) @definition
        (const_item
          name: (identifier) @name
          type: (_) @type
          value: (_) @value) @definition
        (static_item
          name: (identifier) @name
          type: (_) @type
          value: (_) @value) @definition
      ]
    `,
    import: `
      (use_declaration) @definition
    `,
    module: `
      (mod_item
        name: (identifier) @name
        body: (_)? @body) @definition
    `,
  },

  java: {
    function: `
      [
        (method_declaration
          name: (identifier) @name
          parameters: (formal_parameters) @params
          type: (_) @return
          body: (block) @body) @definition
        (constructor_declaration
          name: (identifier) @name
          parameters: (formal_parameters) @params
          body: (constructor_body) @body) @definition
      ]
    `,
    class: `
      [
        (class_declaration
          name: (identifier) @name
          body: (class_body) @body) @definition
        (interface_declaration
          name: (identifier) @name
          body: (interface_body) @body) @definition
        (enum_declaration
          name: (identifier) @name
          body: (enum_body) @body) @definition
      ]
    `,
    variable: `
      [
        (field_declaration
          declarator: (variable_declarator
            name: (identifier) @name
            value: (_)? @value)) @definition
        (local_variable_declaration
          declarator: (variable_declarator
            name: (identifier) @name
            value: (_)? @value)) @definition
      ]
    `,
    import: `
      (import_declaration) @definition
    `,
  },

  c: {
    function: `
      [
        (function_definition
          declarator: (function_declarator
            declarator: (identifier) @name
            parameters: (parameter_list) @params)
          body: (compound_statement) @body) @definition
      ]
    `,
    type: `
      [
        (struct_specifier
          name: (type_identifier) @name
          body: (field_declaration_list)? @body) @definition
        (union_specifier
          name: (type_identifier) @name
          body: (field_declaration_list)? @body) @definition
        (enum_specifier
          name: (type_identifier) @name
          body: (enumerator_list)? @body) @definition
        (type_definition
          declarator: (type_identifier) @name
          type: (_) @value) @definition
      ]
    `,
    variable: `
      [
        (declaration
          declarator: (init_declarator
            declarator: (identifier) @name
            value: (_)? @value)) @definition
      ]
    `,
  },

  cpp: {
    function: `
      [
        (function_definition
          declarator: (function_declarator
            declarator: (identifier) @name
            parameters: (parameter_list) @params)
          body: (compound_statement) @body) @definition
      ]
    `,
    class: `
      [
        (class_specifier
          name: (type_identifier) @name
          body: (field_declaration_list) @body) @definition
        (struct_specifier
          name: (type_identifier) @name
          body: (field_declaration_list) @body) @definition
      ]
    `,
    type: `
      [
        (type_definition
          declarator: (type_identifier) @name
          type: (_) @value) @definition
        (alias_declaration
          name: (type_identifier) @name
          type: (_) @value) @definition
      ]
    `,
    variable: `
      [
        (declaration
          declarator: (init_declarator
            declarator: (identifier) @name
            value: (_)? @value)) @definition
      ]
    `,
    import: `
      (preproc_include) @definition
    `,
  },

  bash: {
    function: `
      (function_definition
        name: (word) @name
        body: (compound_statement) @body) @definition
    `,
    variable: `
      [
        (variable_assignment
          name: (variable_name) @name
          value: (_)? @value) @definition
      ]
    `,
    import: `
      (command
        name: (command_name) @source_cmd
        (#match? @source_cmd "^(source|\\.)$")) @definition
    `,
  },
};

/**
 * Get query for a specific language and symbol kind
 */
export function getQuery(language: string, kind: SymbolKind): string | undefined {
  return LANGUAGE_QUERIES[language]?.[kind];
}

/**
 * Get all queries for a language
 */
export function getLanguageQueries(language: string): QueryDefinition | undefined {
  return LANGUAGE_QUERIES[language];
}

/**
 * Check if a language has query support
 */
export function hasQuerySupport(language: string): boolean {
  return language in LANGUAGE_QUERIES;
}

/**
 * Get all supported languages with query definitions
 */
export function getSupportedLanguagesWithQueries(): string[] {
  return Object.keys(LANGUAGE_QUERIES);
}

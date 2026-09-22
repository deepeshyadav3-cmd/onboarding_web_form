# Makefile for Static Hiring Application Form

.PHONY: help serve dev start validate test-health test-submit clean

PORT ?= 8000
ENDPOINT_URL = https://script.google.com/macros/s/AKfycbyNEJ-Vvk1kG70GlNaeKzt6rz5ZpWALKbBy8oVI46xSe8ZA-K601xNrhJUP8DSGsHFf/exec

help: ## Display available Makefile commands
	@echo ""
	@echo "Available commands:"
	@echo "  make serve       - Start local development HTTP server on http://localhost:$(PORT)"
	@echo "  make dev         - Alias for 'make serve'"
	@echo "  make validate    - Validate JavaScript modules and JSON configuration files"
	@echo "  make test-health - Test live Apps Script doGet health check endpoint"
	@echo "  make help        - Show this help summary"
	@echo ""

serve: ## Start local development server
	@echo "Starting local server at http://localhost:$(PORT)..."
	python3 -m http.server $(PORT)

dev: serve ## Alias for serve

start: serve ## Alias for serve

validate: ## Validate JS module imports and JSON files
	@echo "Validating JSON files..."
	@node -e "JSON.parse(require('fs').readFileSync('config/config.json')); JSON.parse(require('fs').readFileSync('config/form-schema.json')); console.log('✓ Config and Schema JSON syntax valid');"
	@echo "Validating JavaScript ES module syntax..."
	@node -e "import('./assets/js/validator.js'); import('./assets/js/api-client.js'); import('./assets/js/draft-manager.js'); console.log('✓ JS modules syntax valid');"

test-health: ## Query deployed Apps Script health check endpoint
	@echo "Checking endpoint: $(ENDPOINT_URL)..."
	@curl -sL "$(ENDPOINT_URL)" | python3 -m json.tool || curl -sL "$(ENDPOINT_URL)"

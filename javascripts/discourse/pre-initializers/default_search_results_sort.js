import { withPluginApi } from "discourse/lib/plugin-api";
import { isValidSearchTerm } from "discourse/lib/search";
import { scheduleOnce } from "@ember/runloop";
import {
  CATEGORY_SLUG_REGEXP,
  DEFAULT_TYPE_FILTER,
  SUGGESTIONS_REGEXP,
  USERNAME_REGEXP,
} from "discourse/widgets/search-menu";

const PLUGIN_ID = "default-search-results-sorting";

export default {
  name: PLUGIN_ID,
  before: "inject-discourse-objects",

  initializeWithApi(api) {
    /**
     * Must be the same order as Discourse (drop-down list on full search page),
     * and default_search_results_sorting_by setting.
     */
    const sortingChoices = {
      relevance: undefined,
      latest_post: "order:latest",
      most_liked: "order:likes",
      most_viewed: "order:views",
      latest_topic: "order:latest_topic",
      most_votes: "order:votes",
    };

    const defaultSorting =
      sortingChoices[settings.default_search_results_sorting_by];

    const defaultSortingIndex =
      Object.values(sortingChoices).indexOf(defaultSorting);

    if (defaultSorting === undefined) {
      return;
    }

    function cleanTerm(term) {
      return term.replace(defaultSorting, "").trim();
    }

    function cleanRecentSearches(currentUser) {
      if (currentUser) {
        let recentSearches = Object.assign(currentUser.recent_searches || []);
        recentSearches = recentSearches
          .map((term) => cleanTerm(term))
          .filter((term) => term);

        currentUser.set("recent_searches", recentSearches);
      }
    }

    function includesTopics(searchData) {
      return searchData.typeFilter !== DEFAULT_TYPE_FILTER;
    }

    const matchesSuggestions = (searchData) => {
      const term = searchData.term.trim();

      if (term === undefined || includesTopics(searchData)) {
        return false;
      }

      const categoriesMatch = term.match(CATEGORY_SLUG_REGEXP);
      if (categoriesMatch) {
        return { type: "category", categoriesMatch };
      }

      const usernamesMatch = term.match(USERNAME_REGEXP);
      if (usernamesMatch) {
        return { type: "username", usernamesMatch };
      }

      const suggestionsMatch = term.match(SUGGESTIONS_REGEXP);
      if (suggestionsMatch) {
        return suggestionsMatch;
      }

      return false;
    };

    /**
     * Full page search
     * -
     * Changes the default sorting.
     */
    api.modifyClass("controller:full-page-search", {
      pluginId: PLUGIN_ID,

      init() {
        this._super(...arguments);
        this.set("sortOrder", defaultSortingIndex);
      },
    });

    /**
     * Search menu
     * -
     * Hides the sort order option from the search results.
     */
    api.reopenWidget("search-menu-results", {
      pluginId: PLUGIN_ID,

      html(attrs) {
        const {
          invalidTerm,
          inPMInboxContext,
          term,
          suggestionKeyword,
          noResults,
          searchTopics,
        } = attrs;

        if (
          suggestionKeyword !== false &&
          suggestionKeyword?.includes(defaultSorting)
        ) {
          attrs.suggestionKeyword = cleanTerm(suggestionKeyword);
        }

        if (
          !(searchTopics && (invalidTerm || noResults)) ||
          ((!term || !searchTopics) && !inPMInboxContext)
        ) {
          cleanRecentSearches(this.currentUser);
        }

        if (term?.includes(defaultSorting)) {
          attrs.term = cleanTerm(term);
        }

        return this._super(attrs);
      },
    });

    /**
     * Search menu
     * -
     * Adds the default sorting to the search term.
     * Hides the sorting option from the recent searches.
     */
    api.reopenWidget("search-menu", {
      pluginId: PLUGIN_ID,

      /**
       * Search menu
       * -
       * Adds the default sorting to the search term.
       */
      triggerSearch() {
        if (
          !this.searchData.term ||
          !isValidSearchTerm(this.searchData.term, this.siteSettings)
        ) {
          this._super(...arguments);
          return;
        }

        if (!this.searchData.term.includes(defaultSorting)) {
          const matchSuggestions = matchesSuggestions(this.searchData);

          if (
            !matchSuggestions ||
            !this.searchData.term.includes("order:") ||
            (matchSuggestions.type !== "category" &&
              matchSuggestions.type !== "username")
          ) {
            this.searchData.term += ` ${defaultSorting}`;
          }
        }

        this._super(...arguments);
      },

      /**
       * Search menu
       * -
       * Cleans input. The next time the user opens the search menu,
       * the sorting option is added to the search term in some situations.
       */
      html(attrs, state) {
        const content = this._super(attrs, state);

        scheduleOnce("afterRender", () => {
          const searchInput = document.getElementById("search-term");

          if (searchInput?.value.includes(defaultSorting)) {
            searchInput.value = cleanTerm(searchInput.value);
          }
        });

        return content;
      },
    });
  },

  initialize() {
    withPluginApi("0.12.1", this.initializeWithApi);
  },
};

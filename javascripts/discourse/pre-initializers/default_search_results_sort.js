import { withPluginApi } from "discourse/lib/plugin-api";
import { isValidSearchTerm } from "discourse/lib/search";
import { DEFAULT_TYPE_FILTER } from "discourse/widgets/search-menu";

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

    const cleanTerm = (term) => {
      return term.replace(defaultSorting, "").trim();
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
        if (attrs.term?.includes(defaultSorting)) {
          attrs.term = cleanTerm(attrs.term);
        }

        if (
          attrs.suggestionKeyword !== false &&
          attrs.suggestionKeyword?.includes(defaultSorting)
        ) {
          attrs.suggestionKeyword = cleanTerm(attrs.suggestionKeyword);
        }

        return this._super(attrs);
      },
    });

    /**
     * Search menu
     * -
     * Adds the default sorting to the search term.
     * Hides the sort order option from the recent searches.
     */
    api.reopenWidget("search-menu", {
      pluginId: PLUGIN_ID,

      triggerSearch() {
        if (
          !this.searchData.term ||
          !isValidSearchTerm(this.searchData.term, this.siteSettings)
        ) {
          return;
        }

        if (
          !this.searchData.term.includes(defaultSorting) &&
          !this.searchData.term.includes("order:")
        ) {
          this.searchData.term += ` ${defaultSorting}`;
        }

        this._super(...arguments);

        const includesTopics = () =>
          this.searchData.typeFilter !== DEFAULT_TYPE_FILTER;

        if (includesTopics() && this.currentUser) {
          let recentSearches = Object.assign(
            this.currentUser.recent_searches || []
          );
          recentSearches = recentSearches.map((term) => cleanTerm(term));
          this.currentUser.set("recent_searches", recentSearches);
        }
      },
    });
  },

  initialize() {
    withPluginApi("0.12.1", this.initializeWithApi);
  },
};

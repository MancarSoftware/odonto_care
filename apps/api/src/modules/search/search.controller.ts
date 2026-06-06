import { Controller, Get, Query, UseGuards } from "@nestjs/common";

import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { GlobalSearchQueryDto } from "./dto/global-search-query.dto";
import { SearchService } from "./search.service";

@Controller("search")
@UseGuards(JwtAuthGuard, RolesGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  globalSearch(@Query() query: GlobalSearchQueryDto) {
    return this.searchService.globalSearch(query.q);
  }
}
